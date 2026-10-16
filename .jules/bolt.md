## 2024-XX-XX - O(N*M) Lookup Replacements in Dashboards
**Learning:** Found nested loops using `.find()` inside `.map()` iterating over large lists like tasks and scores in the dashboard aggregation route `src/app/api/dashboard/aggregate/route.ts`.
**Action:** Always replace O(N*M) lookups inside loops with O(N) Maps (or similar indexed structures) pre-computed *before* the loop.
