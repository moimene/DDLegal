## 2026-05-22 - O(N^2) Bottlenecks in array iterations
**Learning:** When performing multiple passes on an array using map, filter, or reduce, and especially when including an inner loop lookup like .find() on an array, it leads to O(N^2) complexity which is a performance bottleneck for large datasets.
**Action:** Refactor multiple array iteration passes into a single pass using a for...of loop and avoid inner loop lookups by either maintaining state in a dictionary or retrieving data eagerly in the single pass.
