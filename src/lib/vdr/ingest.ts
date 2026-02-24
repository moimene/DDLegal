import { supabaseAdmin } from '@/lib/supabase-admin';
import { generateEmbeddings } from '@/lib/embeddings';
import { chunkText } from './chunker';
import { computeContentHash } from './content-hash';
import { extractPdfFromDocument, isPdfFile } from './pdf-extractor';
import type { Chunk } from './chunker';

// Worker Architecture v1.0: Post-chunking classification hook
const DD_WORKER_ENABLED = process.env.DD_WORKER === 'true';

export async function startIngestion(documentId: string, versionId?: string): Promise<string> {
  const { data: job, error } = await supabaseAdmin
    .from('vdr_ingestion_jobs')
    .insert({ document_id: documentId, version_id: versionId || null, status: 'pending' })
    .select('id')
    .single();
  if (error || !job) throw new Error(`Failed to create ingestion job: ${error?.message}`);

  processIngestion(job.id, documentId, versionId).catch(err => {
    console.error(`[ingest] Job ${job.id} failed:`, err);
  });
  return job.id;
}

async function processIngestion(jobId: string, documentId: string, versionId?: string) {
  try {
    await supabaseAdmin.from('vdr_ingestion_jobs').update({ status: 'processing', started_at: new Date().toISOString() }).eq('id', jobId);

    const { data: doc } = await supabaseAdmin.from('vdr_documents').select('id, name, description, category, area_code, project_id').eq('id', documentId).single();
    if (!doc) throw new Error('Document not found');

    // Check if document has a PDF version and attempt extraction
    let textContent = doc.description || doc.name;
    let pdfExtracted = false;

    // Fetch version metadata to check if it's a PDF
    const { data: latestVersion } = await supabaseAdmin
      .from('vdr_document_versions')
      .select('id, file_name, mime_type, storage_path')
      .eq('document_id', documentId)
      .order('version_number', { ascending: false })
      .limit(1)
      .single();

    if (latestVersion && isPdfFile(latestVersion.file_name, latestVersion.mime_type)) {
      console.log(`[ingest] Document ${documentId} is a PDF, attempting text extraction`);

      const pdfResult = await extractPdfFromDocument(documentId);

      if (pdfResult.success && pdfResult.text.trim().length > 0) {
        console.log(`[ingest] PDF extraction successful: ${pdfResult.pageCount} pages, ${pdfResult.text.length} chars`);
        textContent = pdfResult.text;
        pdfExtracted = true;

        // Log metadata if available
        if (pdfResult.metadata.title) {
          console.log(`[ingest] PDF title: ${pdfResult.metadata.title}`);
        }
        if (pdfResult.metadata.author) {
          console.log(`[ingest] PDF author: ${pdfResult.metadata.author}`);
        }
      } else {
        console.log(`[ingest] PDF extraction failed or empty, falling back to description: ${pdfResult.error || 'empty text'}`);
      }
    }

    // Append version change notes if provided (for both PDF and non-PDF)
    if (versionId) {
      const { data: version } = await supabaseAdmin.from('vdr_document_versions').select('change_notes').eq('id', versionId).single();
      if (version?.change_notes) {
        textContent = version.change_notes + '\n\n' + textContent;
      }
    }

    console.log(`[ingest] Processing document ${documentId}: ${pdfExtracted ? 'PDF extracted' : 'using description'}, ${textContent.length} chars`);

    // Level-1 cache: compute content hash for deduplication
    const contentHash = computeContentHash(textContent);

    const { data: existingDoc } = await supabaseAdmin
      .from('vdr_documents')
      .select('content_hash, embedding_status')
      .eq('id', documentId)
      .single();

    if (existingDoc?.content_hash === contentHash && existingDoc?.embedding_status === 'done') {
      // Content unchanged, skip re-processing
      await supabaseAdmin.from('vdr_ingestion_jobs').update({
        status: 'completed',
        chunks_created: 0,
        completed_at: new Date().toISOString(),
      }).eq('id', jobId);
      return;
    }

    // Mark as processing
    await supabaseAdmin.from('vdr_documents').update({
      embedding_status: 'processing',
    }).eq('id', documentId);

    await supabaseAdmin.from('vdr_chunks').delete().eq('document_id', documentId);

    const chunks: Chunk[] = chunkText(textContent);
    if (chunks.length === 0) {
      await supabaseAdmin.from('vdr_ingestion_jobs').update({ status: 'completed', chunks_created: 0, completed_at: new Date().toISOString() }).eq('id', jobId);
      return;
    }

    const embeddings = await generateEmbeddings(chunks.map(c => c.content));

    const rows = chunks.map((chunk, i) => ({
      document_id: documentId,
      version_id: versionId || null,
      content: chunk.content,
      embedding: JSON.stringify(embeddings[i]),
      chunk_index: chunk.chunk_index,
      page_number: chunk.page_number,
      section_title: chunk.section_title,
      category: doc.category,
      token_count: chunk.token_count,
      metadata: { source_document_name: doc.name, area_code: doc.area_code },
    }));

    const { error: insertError } = await supabaseAdmin.from('vdr_chunks').insert(rows);
    if (insertError) throw new Error(`Chunk insert failed: ${insertError.message}`);

    // Update cache columns after successful embedding
    await supabaseAdmin.from('vdr_documents').update({
      content_hash: contentHash,
      embedding_status: 'done',
      last_embedded_at: new Date().toISOString(),
    }).eq('id', documentId);

    await supabaseAdmin.from('vdr_ingestion_jobs').update({ status: 'completed', chunks_created: chunks.length, completed_at: new Date().toISOString() }).eq('id', jobId);

    // Worker Architecture v1.0: Post-chunking classification hook
    // Non-blocking: classify document after successful ingestion
    if (DD_WORKER_ENABLED && doc.project_id) {
      runPostIngestionClassification(documentId, doc.project_id).catch(err => {
        console.error(`[ingest] Post-ingestion classification failed for ${documentId}:`, err);
      });
    }
  } catch (err) {
    // Mark embedding as stale on failure
    await supabaseAdmin.from('vdr_documents').update({
      embedding_status: 'stale',
    }).eq('id', documentId);
    await supabaseAdmin.from('vdr_ingestion_jobs').update({ status: 'failed', error_message: (err as Error).message, completed_at: new Date().toISOString() }).eq('id', jobId);
  }
}

/**
 * Worker Architecture v1.0: Post-ingestion classification hook
 *
 * Triggered after successful document ingestion when DD_WORKER is enabled.
 * Runs classification (fast path) and optionally queues for full fact extraction.
 */
async function runPostIngestionClassification(documentId: string, projectId: string): Promise<void> {
  try {
    // Dynamic import to avoid circular dependencies
    const { classifyDocument } = await import('@/lib/worker/document-classifier');

    // Run fast classification (pattern-based, no AI unless needed)
    const classification = await classifyDocument(documentId, { useAiFallback: false });

    // Update document with classification results if confident
    if (classification.confidence >= 0.7) {
      const updateData: Record<string, unknown> = {};

      // Update area_code if found and document doesn't have one
      if (classification.area_codes.length > 0) {
        updateData.area_code = classification.area_codes[0];
      }

      // Store classification metadata
      updateData.metadata = {
        classification: {
          document_type: classification.document_type,
          area_codes: classification.area_codes,
          jurisdiction: classification.jurisdiction,
          language: classification.language,
          confidence: classification.confidence,
          method: classification.method,
          classified_at: new Date().toISOString(),
        },
      };

      if (Object.keys(updateData).length > 0) {
        await supabaseAdmin
          .from('vdr_documents')
          .update(updateData)
          .eq('id', documentId);
      }

      console.log(`[ingest] Classified document ${documentId}: ${classification.document_type} (${classification.area_codes.join(', ')}) [${classification.method}, ${(classification.confidence * 100).toFixed(0)}%]`);
    }

    // Queue for full fact extraction if DD_WORKER is enabled
    // This creates a pending entry in dd_fo_document_status for all applicable FOs
    const { extractDocumentFacts } = await import('@/lib/worker/fact-extractor');

    // Non-blocking: extract facts in background
    extractDocumentFacts(documentId, projectId).catch(err => {
      console.error(`[ingest] Fact extraction failed for ${documentId}:`, err);
    });

  } catch (err) {
    console.error(`[ingest] Post-ingestion classification error for ${documentId}:`, err);
    // Non-critical: don't fail the ingestion if classification fails
  }
}
