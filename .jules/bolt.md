## 2024-05-28 - Refactoring Array Aggregations
**Learning:** Multiple array traversals (like `.filter()`, `.map()`, `.reduce()`, and nested `.find()`) can easily lead to O(N²) bottlenecks in data-heavy scoring engines.
**Action:** Combine these operations into a single O(N) pass, accumulating derived arrays and scalar metrics together to minimize iteration overhead and avoid nested lookups.