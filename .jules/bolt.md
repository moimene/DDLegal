## 2024-05-24 - Intl Initialization Overhead
**Learning:** Instantiating `Intl.DateTimeFormat` and `Intl.NumberFormat` objects has a surprisingly high initialization overhead. Creating new instances frequently (like inside render cycles or loop iterations) can cause significant performance degradation.
**Action:** Always use the centralized `getCachedDateTimeFormat` and `getCachedNumberFormat` utilities in `src/lib/utils.ts` instead of directly instantiating new formatters to avoid redundant initialization costs.
