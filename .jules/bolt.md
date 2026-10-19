
## 2024-05-24 - Single Pass Loop for Multiple Aggregations
**Learning:** When refactoring array mappings into a single O(N) pass to resolve performance bottlenecks, combine separate array aggregations (e.g., reduce for totals, multiple map/filter passes, or separate loop iterations for sensitivity calculations) into the same loop to minimize iteration overhead.
**Action:** Apply this to functions that repeatedly iterate over the same large dataset to calculate multiple disparate values.
