## 2026-06-05 - O(N) Optimization in deal-risk-score
**Learning:** Refactoring multiple `.reduce` calls and nested `.find()` iterations over the same array into a single O(N) `.map` pass significantly reduces execution time (from 13500ms to 85ms for 50k records).
**Action:** When performing aggregate operations or mappings over a dataset, consolidate them into a single loop to avoid repetitive iteration and nested lookups.
