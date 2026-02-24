/**
 * Chunk Markdown Documents Script
 *
 * Processes markdown documents that were uploaded but not chunked.
 * Reads content from storage, chunks it, generates embeddings, and inserts into vdr_chunks.
 *
 * Usage: npx tsx scripts/chunk-markdown-docs.ts
 */

import { createClient } from '@supabase/supabase-js';

// Load environment variables
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

if (!OPENAI_API_KEY) {
  console.error('Missing OPENAI_API_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL.replace(/\\n/g, ''), SUPABASE_SERVICE_KEY.replace(/\\n/g, ''));

const PROJECT_ID = 'a1b2c3d4-0001-4000-8000-000000000001';
const BUCKET = 'vdr-documents';

// Simple chunking function
function chunkText(text: string, maxTokens: number = 500): Array<{
  content: string;
  chunk_index: number;
  page_number: number;
  section_title: string | null;
  token_count: number;
}> {
  const chunks: Array<{
    content: string;
    chunk_index: number;
    page_number: number;
    section_title: string | null;
    token_count: number;
  }> = [];

  // Split by paragraphs
  const paragraphs = text.split(/\n\n+/);
  let currentChunk = '';
  let currentTokens = 0;
  let chunkIndex = 0;

  for (const para of paragraphs) {
    // Rough token estimation (1 token ~= 4 chars)
    const paraTokens = Math.ceil(para.length / 4);

    if (currentTokens + paraTokens > maxTokens && currentChunk.length > 0) {
      // Save current chunk
      chunks.push({
        content: currentChunk.trim(),
        chunk_index: chunkIndex,
        page_number: 1,
        section_title: null,
        token_count: currentTokens,
      });
      chunkIndex++;
      currentChunk = '';
      currentTokens = 0;
    }

    currentChunk += para + '\n\n';
    currentTokens += paraTokens;
  }

  // Don't forget the last chunk
  if (currentChunk.trim().length > 0) {
    chunks.push({
      content: currentChunk.trim(),
      chunk_index: chunkIndex,
      page_number: 1,
      section_title: null,
      token_count: currentTokens,
    });
  }

  return chunks;
}

async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const batchSize = 20;
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);

    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: batch,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} ${error}`);
    }

    const data = await response.json();
    for (const item of data.data) {
      allEmbeddings.push(item.embedding);
    }

    // Rate limiting
    if (i + batchSize < texts.length) {
      await new Promise(r => setTimeout(r, 200));
    }
  }

  return allEmbeddings;
}

async function processDocument(doc: {
  id: string;
  name: string;
  category: string | null;
  area_code: string | null;
}): Promise<{ success: boolean; chunks: number; error?: string }> {
  try {
    // Get the latest version to find storage path
    const { data: version, error: versionError } = await supabase
      .from('vdr_document_versions')
      .select('storage_path')
      .eq('document_id', doc.id)
      .order('version_number', { ascending: false })
      .limit(1)
      .single();

    if (versionError || !version) {
      return { success: false, chunks: 0, error: 'No version found' };
    }

    // Download content from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from(BUCKET)
      .download(version.storage_path);

    if (downloadError || !fileData) {
      return { success: false, chunks: 0, error: `Download failed: ${downloadError?.message}` };
    }

    const content = await fileData.text();

    if (content.trim().length < 50) {
      return { success: false, chunks: 0, error: 'Content too short' };
    }

    // Delete existing chunks
    await supabase.from('vdr_chunks').delete().eq('document_id', doc.id);

    // Chunk the content
    const chunks = chunkText(content);

    if (chunks.length === 0) {
      return { success: false, chunks: 0, error: 'No chunks generated' };
    }

    // Generate embeddings
    const embeddings = await generateEmbeddings(chunks.map(c => c.content));

    // Insert chunks
    const rows = chunks.map((chunk, i) => ({
      document_id: doc.id,
      version_id: null,
      content: chunk.content,
      embedding: JSON.stringify(embeddings[i]),
      chunk_index: chunk.chunk_index,
      page_number: chunk.page_number,
      section_title: chunk.section_title,
      category: doc.category,
      token_count: chunk.token_count,
      metadata: { source_document_name: doc.name, area_code: doc.area_code },
    }));

    const { error: insertError } = await supabase.from('vdr_chunks').insert(rows);

    if (insertError) {
      return { success: false, chunks: 0, error: `Insert failed: ${insertError.message}` };
    }

    // Update document status
    await supabase
      .from('vdr_documents')
      .update({
        status: 'indexed',
        embedding_status: 'done',
        last_embedded_at: new Date().toISOString(),
      })
      .eq('id', doc.id);

    return { success: true, chunks: chunks.length };
  } catch (err) {
    return { success: false, chunks: 0, error: (err as Error).message };
  }
}

async function main() {
  console.log('=== Chunk Markdown Documents ===');
  console.log(`Project: ${PROJECT_ID}`);

  // Get documents without chunks
  const { data: documents, error: queryError } = await supabase
    .from('vdr_documents')
    .select(`
      id, name, category, area_code,
      chunks:vdr_chunks(count)
    `)
    .eq('project_id', PROJECT_ID)
    .in('status', ['uploaded', 'processing']);

  if (queryError || !documents) {
    console.error('Failed to query documents:', queryError);
    process.exit(1);
  }

  // Filter to documents without chunks
  const docsToProcess = documents.filter(d => {
    const chunkCount = (d.chunks as unknown as Array<{ count: number }>)?.[0]?.count ?? 0;
    return chunkCount === 0;
  });

  console.log(`Documents to process: ${docsToProcess.length}`);

  let success = 0;
  let failed = 0;
  const errors: string[] = [];

  for (let i = 0; i < docsToProcess.length; i++) {
    const doc = docsToProcess[i];
    process.stdout.write(`\r[${i + 1}/${docsToProcess.length}] Processing: ${doc.name.substring(0, 40)}...`);

    const result = await processDocument({
      id: doc.id,
      name: doc.name,
      category: doc.category,
      area_code: doc.area_code,
    });

    if (result.success) {
      success++;
    } else {
      failed++;
      errors.push(`${doc.name}: ${result.error}`);
    }

    // Rate limiting
    await new Promise(r => setTimeout(r, 100));
  }

  console.log('\n\n=== Complete ===');
  console.log(`Success: ${success}`);
  console.log(`Failed: ${failed}`);

  if (errors.length > 0 && errors.length <= 10) {
    console.log('\nErrors:');
    errors.forEach(e => console.log(`  - ${e}`));
  } else if (errors.length > 10) {
    console.log(`\nFirst 10 errors of ${errors.length}:`);
    errors.slice(0, 10).forEach(e => console.log(`  - ${e}`));
  }
}

main().catch(console.error);
