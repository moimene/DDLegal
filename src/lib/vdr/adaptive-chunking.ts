// ---------------------------------------------------------------------------
// Workstream L — Task L.2: Adaptive chunking by document type
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChunkingConfig {
  /** Target chunk size in characters */
  chunkSize: number;
  /** Overlap between consecutive chunks in characters */
  overlap: number;
  /** Human-readable label for the document type */
  label: string;
}

export interface ChunkResult {
  /** The chunk text */
  text: string;
  /** Character offset where this chunk starts in the original text */
  startOffset: number;
  /** Character offset where this chunk ends in the original text (exclusive) */
  endOffset: number;
  /** Zero-based chunk index */
  chunkIndex: number;
}

// ---------------------------------------------------------------------------
// Document-type configuration map
// ---------------------------------------------------------------------------

const CHUNKING_CONFIGS: Record<string, ChunkingConfig> = {
  // Spanish labels
  contrato:   { chunkSize: 1500, overlap: 200, label: 'Contrato' },
  acta:       { chunkSize: 1000, overlap: 150, label: 'Acta' },
  escritura:  { chunkSize: 2000, overlap: 300, label: 'Escritura' },
  financiero: { chunkSize:  800, overlap: 100, label: 'Financiero' },

  // English aliases
  contract:   { chunkSize: 1500, overlap: 200, label: 'Contract' },
  minutes:    { chunkSize: 1000, overlap: 150, label: 'Minutes' },
  deed:       { chunkSize: 2000, overlap: 300, label: 'Deed' },
  financial:  { chunkSize:  800, overlap: 100, label: 'Financial' },
};

const DEFAULT_CONFIG: ChunkingConfig = {
  chunkSize: 1200,
  overlap: 200,
  label: 'Default',
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Return the chunking configuration for a given document type.
 * Matching is case-insensitive and supports both Spanish and English labels.
 * Falls back to the default config for unknown types.
 */
export function getChunkingConfig(documentType: string): ChunkingConfig {
  const key = documentType.toLowerCase().trim();
  return CHUNKING_CONFIGS[key] ?? DEFAULT_CONFIG;
}

/**
 * Split `text` into overlapping chunks whose sizes are determined by
 * the document type.  The function tries to break at sentence boundaries
 * (period + whitespace) so chunks stay semantically coherent, but will
 * fall back to a hard split when no suitable break-point exists.
 *
 * @param text          Full document text to chunk
 * @param documentType  Document category string (e.g. "contrato", "financial")
 * @returns             Array of ChunkResult with offset metadata
 */
export function adaptiveChunk(
  text: string,
  documentType: string,
): ChunkResult[] {
  if (!text || text.trim().length === 0) return [];

  const config = getChunkingConfig(documentType);
  const { chunkSize, overlap } = config;

  const results: ChunkResult[] = [];
  let cursor = 0;
  let chunkIndex = 0;

  while (cursor < text.length) {
    // Determine the raw end for this chunk
    let end = Math.min(cursor + chunkSize, text.length);

    // If we are not at the end of the text, try to break at a sentence boundary
    if (end < text.length) {
      end = findSentenceBreak(text, cursor, end);
    }

    const chunkText = text.slice(cursor, end);

    // Skip empty chunks (shouldn't happen, but be defensive)
    if (chunkText.trim().length > 0) {
      results.push({
        text: chunkText,
        startOffset: cursor,
        endOffset: end,
        chunkIndex,
      });
      chunkIndex++;
    }

    // Advance cursor: move forward by (chunk length - overlap)
    const advance = end - cursor - overlap;
    if (advance <= 0) {
      // Prevent infinite loop on very small text or large overlap
      cursor = end;
    } else {
      cursor += advance;
    }

    // If cursor went past the end, stop
    if (cursor >= text.length) break;
  }

  return results;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Given a range [start, rawEnd) in `text`, find the best sentence-boundary
 * position to break at.  We look for the last occurrence of sentence-ending
 * punctuation (`. `, `.\n`, `; `, `:\n`) within the range.  If none is found
 * we look for any whitespace break.  If that also fails we return `rawEnd`.
 */
function findSentenceBreak(text: string, start: number, rawEnd: number): number {
  // Look in the last 30 % of the chunk for a sentence break
  const searchFrom = start + Math.floor((rawEnd - start) * 0.7);
  const region = text.slice(searchFrom, rawEnd);

  // Try sentence-ending patterns (greedy — take the last match)
  const sentenceEnd = /[.;:!?]\s/g;
  let lastMatch = -1;
  let m: RegExpExecArray | null;
  while ((m = sentenceEnd.exec(region)) !== null) {
    // Position right after the punctuation + space
    lastMatch = searchFrom + m.index + m[0].length;
  }

  if (lastMatch > start) return lastMatch;

  // Fallback: break at the last whitespace in the chunk
  const lastSpace = text.lastIndexOf(' ', rawEnd);
  if (lastSpace > searchFrom) return lastSpace + 1;

  // No good break-point — hard split
  return rawEnd;
}
