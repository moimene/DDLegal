## 2026-05-30 - Refactor O(N²) nested array loop
**Learning:** Avoid using O(N) `.find()` lookups inside mapping or iteration loops, especially in performance-critical code where N can be large. This creates an O(N²) bottleneck.
**Action:** Combine operations into a single loop pass (O(N)), which simultaneously builds maps/aggregations, avoids the need for inner lookups, and reduces overhead.
