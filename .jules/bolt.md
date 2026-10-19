## 2024-03-24 - O(N²) Anti-Pattern in List Processing
**Learning:** During array mapping, using a nested `.find()` on the same array to fetch original values creates an O(N²) bottleneck. This degrades performance significantly when processing large datasets (like findings in risk scoring).
**Action:** Always combine operations into a single loop pass (O(N) complexity) to process elements, group them, and accumulate metrics without needing nested lookups.
