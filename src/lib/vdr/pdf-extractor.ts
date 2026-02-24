import { PDFParse } from 'pdf-parse';
import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * Result of PDF text extraction
 */
export interface PdfExtractionResult {
  success: boolean;
  text: string;
  pageCount: number;
  metadata: {
    title: string | null;
    author: string | null;
    creationDate: Date | null;
    modificationDate: Date | null;
  };
  error?: string;
}

/**
 * Check if a file is a PDF based on filename or MIME type
 */
export function isPdfFile(filename?: string | null, mimeType?: string | null): boolean {
  if (mimeType?.toLowerCase() === 'application/pdf') {
    return true;
  }
  if (filename?.toLowerCase().endsWith('.pdf')) {
    return true;
  }
  return false;
}

/**
 * Extract text content from a PDF file stored in Supabase Storage
 */
export async function extractPdfText(
  storagePath: string,
  bucket: string = 'vdr-documents'
): Promise<PdfExtractionResult> {
  let parser: PDFParse | null = null;

  try {
    console.log(`[ingest] Downloading PDF from storage: ${bucket}/${storagePath}`);

    // Download the file from Supabase Storage
    const { data, error } = await supabaseAdmin.storage
      .from(bucket)
      .download(storagePath);

    if (error) {
      console.error(`[ingest] Failed to download PDF: ${error.message}`);
      return {
        success: false,
        text: '',
        pageCount: 0,
        metadata: { title: null, author: null, creationDate: null, modificationDate: null },
        error: `Storage download failed: ${error.message}`,
      };
    }

    if (!data) {
      return {
        success: false,
        text: '',
        pageCount: 0,
        metadata: { title: null, author: null, creationDate: null, modificationDate: null },
        error: 'No data returned from storage',
      };
    }

    // Convert Blob to ArrayBuffer then to Uint8Array
    const arrayBuffer = await data.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    console.log(`[ingest] Parsing PDF (${uint8Array.length} bytes)`);

    // Create PDFParse instance with the data
    parser = new PDFParse({ data: uint8Array });

    // Get document info including metadata
    const info = await parser.getInfo();

    // Extract text from all pages
    const textResult = await parser.getText();

    const pageCount = info.total || 0;
    const fullText = textResult.text || '';

    console.log(`[ingest] PDF extracted: ${pageCount} pages, ${fullText.length} chars`);

    // Extract metadata - info dictionary contains Title, Author, etc.
    const infoDict = info.info as Record<string, unknown> | undefined;
    const dateNode = info.getDateNode();

    return {
      success: true,
      text: fullText,
      pageCount,
      metadata: {
        title: (infoDict?.Title as string) || null,
        author: (infoDict?.Author as string) || null,
        creationDate: dateNode?.CreationDate || null,
        modificationDate: dateNode?.ModDate || null,
      },
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[ingest] PDF extraction failed: ${errorMessage}`);
    return {
      success: false,
      text: '',
      pageCount: 0,
      metadata: { title: null, author: null, creationDate: null, modificationDate: null },
      error: errorMessage,
    };
  } finally {
    // Clean up PDFParse instance to free resources
    if (parser) {
      try {
        await parser.destroy();
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}

/**
 * Extract PDF text from a document by its ID
 * Fetches the latest version's storage_path and extracts text
 */
export async function extractPdfFromDocument(
  documentId: string
): Promise<PdfExtractionResult> {
  try {
    // Get the latest version with storage_path
    const { data: version, error: versionError } = await supabaseAdmin
      .from('vdr_document_versions')
      .select('id, storage_path, mime_type, file_name')
      .eq('document_id', documentId)
      .order('version_number', { ascending: false })
      .limit(1)
      .single();

    if (versionError || !version) {
      console.log(`[ingest] No version found for document ${documentId}`);
      return {
        success: false,
        text: '',
        pageCount: 0,
        metadata: { title: null, author: null, creationDate: null, modificationDate: null },
        error: versionError?.message || 'No document version found',
      };
    }

    // Check if it's a PDF
    if (!isPdfFile(version.file_name, version.mime_type)) {
      console.log(`[ingest] Document ${documentId} is not a PDF (mime: ${version.mime_type}, file: ${version.file_name})`);
      return {
        success: false,
        text: '',
        pageCount: 0,
        metadata: { title: null, author: null, creationDate: null, modificationDate: null },
        error: 'Document is not a PDF file',
      };
    }

    if (!version.storage_path) {
      console.log(`[ingest] Document ${documentId} has no storage_path`);
      return {
        success: false,
        text: '',
        pageCount: 0,
        metadata: { title: null, author: null, creationDate: null, modificationDate: null },
        error: 'No storage path for document version',
      };
    }

    console.log(`[ingest] Extracting PDF for document ${documentId} from ${version.storage_path}`);

    return await extractPdfText(version.storage_path);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[ingest] extractPdfFromDocument failed: ${errorMessage}`);
    return {
      success: false,
      text: '',
      pageCount: 0,
      metadata: { title: null, author: null, creationDate: null, modificationDate: null },
      error: errorMessage,
    };
  }
}
