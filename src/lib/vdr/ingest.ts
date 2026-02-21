import { supabaseAdmin } from '@/lib/supabase-admin';
import { generateEmbeddings } from '@/lib/embeddings';
import { chunkText } from './chunker';
import type { Chunk } from './chunker';

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

    let textContent = doc.description || doc.name;
    if (versionId) {
      const { data: version } = await supabaseAdmin.from('vdr_document_versions').select('change_notes').eq('id', versionId).single();
      if (version?.change_notes) textContent = version.change_notes + '\n\n' + textContent;
    }

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

    await supabaseAdmin.from('vdr_ingestion_jobs').update({ status: 'completed', chunks_created: chunks.length, completed_at: new Date().toISOString() }).eq('id', jobId);
  } catch (err) {
    await supabaseAdmin.from('vdr_ingestion_jobs').update({ status: 'failed', error_message: (err as Error).message, completed_at: new Date().toISOString() }).eq('id', jobId);
  }
}
