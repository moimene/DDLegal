## 2024-05-24 - Single Pass Operations for Scoring
**Learning:** O(N^2) bottlenecks can be subtly introduced when using `.find()` inside a loop over a mapped array to cross-reference data. In large datasets, these nested loops destroy performance.
**Action:** When filtering, mapping, aggregating, and classifying elements from an array, combine all operations into a single O(N) pass to avoid multiple iterations and eliminate the need for nested array lookups.
