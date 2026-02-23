import { createHash } from 'crypto';

/**
 * Compute SHA-256 hash of text content for cache deduplication.
 */
export function computeContentHash(content: string): string {
  return createHash('sha256').update(content, 'utf-8').digest('hex');
}

/**
 * Compute evidence hash from an array of document content hashes.
 * Sorts hashes alphabetically before hashing to ensure deterministic output.
 */
export function computeEvidenceHash(contentHashes: string[]): string {
  const sorted = [...contentHashes].sort();
  return createHash('sha256').update(sorted.join('|'), 'utf-8').digest('hex');
}
