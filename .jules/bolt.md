
## 2024-05-18 - Single-Pass Aggregation over O(N^2) Nested Lookups
**Learning:** In `calculateDealRiskScore`, an O(N^2) bottleneck existed due to a `find()` inside a mapping loop across the same original data set to map over elements and compute the critical_count per area group. Grouping elements that contain separated aggregation calculations via array methods iteratively can lead to poor performance on larger items arrays.
**Action:** Consolidate data structure mappings and separate array aggregations (like `.reduce` for totals, grouping lookups, filtering) into a single O(N) pass to minimize iteration overhead and avoid nested O(N) calls when dealing with the same dataset structure.
