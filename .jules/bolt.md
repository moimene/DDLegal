
## 2024-05-13 - O(N^2) Nested lookups inside array loops
**Learning:** In `src/lib/scoring/deal-risk-score.ts`, an O(N^2) bottleneck existed due to the use of `.find()` to map back to original data inside a secondary `.map` equivalent loop. This is a common but dangerous pattern where mapped outputs are re-correlated with their inputs using nested searches.
**Action:** When filtering, mapping and reducing arrays, combine operations into a single O(N) `for` loop pass to achieve optimal performance and avoid nested lookups entirely.
