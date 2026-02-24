const OPENAI_API_URL = 'https://api.openai.com/v1/embeddings';
const MODEL = 'text-embedding-3-small';
const MAX_BATCH = 100;
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000; // 1s, 4s, 16s (base 4)
const MAX_DELAY_MS = 60000; // 1 minute max

interface EmbeddingResponse {
  data: Array<{ embedding: number[]; index: number }>;
  usage: { prompt_tokens: number; total_tokens: number };
}

/**
 * Sleep helper for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured');
  const results: number[][] = [];
  for (let i = 0; i < texts.length; i += MAX_BATCH) {
    const batch = texts.slice(i, i + MAX_BATCH);
    const embeddings = await fetchWithRetry(batch, apiKey);
    results.push(...embeddings);
  }
  return results;
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const [embedding] = await generateEmbeddings([text]);
  return embedding;
}

async function fetchWithRetry(texts: string[], apiKey: string): Promise<number[][]> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(OPENAI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ model: MODEL, input: texts }),
      });

      // Handle rate limiting with Retry-After header
      if (res.status === 429) {
        const retryAfter = res.headers.get('Retry-After');
        const waitMs = retryAfter
          ? Math.min(parseInt(retryAfter, 10) * 1000, MAX_DELAY_MS)
          : Math.min(BASE_DELAY_MS * Math.pow(4, attempt), MAX_DELAY_MS);

        console.warn(`[embeddings] Rate limited (429), waiting ${waitMs}ms before retry ${attempt + 1}/${MAX_RETRIES}`);
        await sleep(waitMs);
        continue;
      }

      // Handle server errors (5xx) with exponential backoff
      if (res.status >= 500 && res.status < 600) {
        const waitMs = Math.min(BASE_DELAY_MS * Math.pow(4, attempt), MAX_DELAY_MS);
        console.warn(`[embeddings] Server error (${res.status}), waiting ${waitMs}ms before retry ${attempt + 1}/${MAX_RETRIES}`);
        await sleep(waitMs);
        continue;
      }

      // Skip retry for auth errors (401, 403) - throw immediately
      if (res.status === 401 || res.status === 403) {
        const errorText = await res.text();
        throw new Error(`OpenAI API auth error: ${res.status} ${errorText}`);
      }

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`OpenAI API error: ${res.status} ${errorText}`);
      }

      const body: EmbeddingResponse = await res.json();
      return body.data.sort((a, b) => a.index - b.index).map(d => d.embedding);

    } catch (err) {
      lastError = err as Error;

      // Don't retry on auth failures - they won't succeed
      if (lastError.message.includes('401') || lastError.message.includes('403') || lastError.message.includes('auth error')) {
        throw lastError;
      }

      if (attempt < MAX_RETRIES - 1) {
        const waitMs = Math.min(BASE_DELAY_MS * Math.pow(4, attempt), MAX_DELAY_MS);
        console.warn(`[embeddings] Request failed, waiting ${waitMs}ms before retry ${attempt + 1}/${MAX_RETRIES}: ${lastError.message}`);
        await sleep(waitMs);
      }
    }
  }

  throw lastError || new Error('Embedding generation failed after all retries');
}
