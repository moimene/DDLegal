
## 2024-04-29 - [Batching semantic search embeddings and queries]
**Learning:** Found an N+1 query bottleneck in `multiQueryRetrieval` where generating embeddings with OpenAI and querying Supabase vector database for each section were done sequentially in a `for` loop, causing major performance delays during report generation multi-query retrievals.
**Action:** Extracted `semanticSearchWithEmbedding` to take pre-generated embeddings. Batched all search queries into a single `generateEmbeddings` call to hit OpenAI once, then used `Promise.all` over the resulting embeddings to hit the Supabase database RPC concurrently.
