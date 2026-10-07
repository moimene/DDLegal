## 2025-02-12 - Nested Map & Find
**Learning:** Found O(N^2) `.map(..)` loops using `.find(..)` or regex/string lowercasing internally for finding refs and hits matching arrays. This causes N*M operations, and heavy performance issues when using large lists.
**Action:** Replace nested `find` and lowercasing inside mapping functions by pre-computing normalized title slugs to a Map `key -> value` mapping first before traversing arrays in $O(N)$ pass.
