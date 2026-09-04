## 2024-05-24 - [Performance] Fix N+1 queries in Supabase mutations
**Learning:** Sequential `.upsert()` and `.insert()` operations within loops cause significant N+1 query overhead in API routes.
**Action:** Always map valid records into an array and perform a single batch `.upsert()` or `.insert()` call to Supabase. This significantly reduces network roundtrips and execution time.