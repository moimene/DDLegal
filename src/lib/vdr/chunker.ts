export interface Chunk {
  content: string;
  chunk_index: number;
  page_number: number | null;
  section_title: string | null;
  token_count: number;
}

const TARGET_TOKENS = 500;
const OVERLAP_TOKENS = 50;

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function chunkText(text: string, options?: { targetTokens?: number; overlapTokens?: number }): Chunk[] {
  const target = options?.targetTokens ?? TARGET_TOKENS;
  const overlap = options?.overlapTokens ?? OVERLAP_TOKENS;
  const targetChars = target * 4;
  const overlapChars = overlap * 4;

  if (!text || text.trim().length === 0) return [];

  const sectionRegex = /^(?:#{1,4}\s+.+|[A-ZÁÉÍÓÚÑ\s]{10,}|(?:\d+\.)+\s+.+)$/gm;
  const sections: Array<{ title: string | null; content: string; pageHint: number | null }> = [];
  let lastIndex = 0;
  let currentTitle: string | null = null;
  let match: RegExpExecArray | null;

  while ((match = sectionRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      sections.push({ title: currentTitle, content: text.slice(lastIndex, match.index).trim(), pageHint: null });
    }
    currentTitle = match[0].replace(/^#+\s*/, '').trim();
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    sections.push({ title: currentTitle, content: text.slice(lastIndex).trim(), pageHint: null });
  }
  if (sections.length === 0) {
    sections.push({ title: null, content: text.trim(), pageHint: null });
  }

  const chunks: Chunk[] = [];
  let chunkIndex = 0;

  for (const section of sections) {
    const sectionText = section.content;
    if (!sectionText) continue;
    const paragraphs = sectionText.split(/\n\n+/).filter(p => p.trim());
    let buffer = '';

    for (const para of paragraphs) {
      if (buffer.length + para.length > targetChars && buffer.length > 0) {
        chunks.push({ content: buffer.trim(), chunk_index: chunkIndex++, page_number: section.pageHint, section_title: section.title, token_count: estimateTokens(buffer) });
        const words = buffer.split(/\s+/);
        const overlapWords = Math.ceil(overlapChars / 5);
        buffer = words.slice(-overlapWords).join(' ') + '\n\n' + para;
      } else {
        buffer = buffer ? buffer + '\n\n' + para : para;
      }
    }
    if (buffer.trim()) {
      chunks.push({ content: buffer.trim(), chunk_index: chunkIndex++, page_number: section.pageHint, section_title: section.title, token_count: estimateTokens(buffer) });
    }
  }
  return chunks;
}
