## 2026-06-01 - Eliminate O(N^2) lookup in array mapping
**Learning:** Nested lookups like .find() inside loops over mapped arrays cause severe O(N^2) degradation, which can be avoided by carrying required original properties into the mapped object or combining loops.
**Action:** Extend mapped object interfaces to include necessary original fields or merge multiple iterations (mapping, grouping, reducing) into a single O(N) pass to minimize overhead.
