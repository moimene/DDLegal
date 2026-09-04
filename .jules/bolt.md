## 2025-01-28 - Consolidate Deal Risk Score Arrays

**Learning:** In highly mathematical or data processing functions (like `calculateDealRiskScore`), chained array methods (`.filter().map().reduce()`) combined with nested `.find()` lookups can quickly become O(N²) bottlenecks. Creating separate iterations over the same data unnecessarily increases memory overhead and CPU cycles.

**Action:** Consolidate array mappings, aggregations, grouping operations, and derived collections (like `dealBreakers`) into a single O(N) `for...of` pass. This prevents redundant iterations over the data and allows direct O(1) access to the item, eliminating the need for expensive O(N) backward lookups (like `.find()`).