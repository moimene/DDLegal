
## 2024-04-26 - Batch embeddings and parallel vector search
**Learning:** In VDR multi-query retrieval, retrieving multiple sections sequentially caused an N+1 performance bottleneck because of individual calls to OpenAI's embedding API and sequential vector search database queries.
**Action:** Extract all required search queries for sections, batch generate their embeddings in a single call using `generateEmbeddings`, and use `Promise.all` with a new `semanticSearchWithEmbedding` helper to perform vector search concurrently.
