## 2024-05-30 - Replace O(N²) lookups inside loops with O(1) Maps
**Learning:** Found nested loops and `.find` operations inside `.map` over array elements (e.g. `const proj = (projectsRes.data || []).find(p => p.id === t.project_id);` in `src/app/api/dashboard/aggregate/route.ts`). In a worst-case scenario with hundreds of elements, this causes an O(N*M) complexity bottleneck.
**Action:** Always pre-compute a lookup `Map` (or `Record`) for data referenced inside a `.map` loop to change O(N) `.find` lookups into O(1) direct accesses.
