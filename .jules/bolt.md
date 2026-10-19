## 2024-05-18 - Avoid O(N^2) Array Find During Iteration
**Learning:** During risk score calculation, using `.find()` inside a loop (or mapping) over the same array causes O(N^2) complexity. This is especially impactful when iterating through potentially large lists of findings or items.
**Action:** Consolidate array iterations into a single pass to achieve O(N) complexity or pre-compute maps for O(1) lookups instead of nested array searches.
