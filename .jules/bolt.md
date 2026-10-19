## 2025-01-21 - O(N^2) Bottleneck in Array Processing
**Learning:** Combining multiple array iterations (`filter`, `map`, `reduce`, `find`) into a single pass turns an O(N^2) operation into O(N). Specifically, `.find()` inside a loop over elements of a mapped array causes significant performance degradation as N grows.
**Action:** Consolidate array iterations and avoid nested loop lookups where possible to optimize data processing pipelines.
