## 2024-05-18 - Caching Intl Formatters
**Learning:** Repeated instantiations of `Intl.DateTimeFormat` and `Intl.NumberFormat` create a performance bottleneck due to high initialization overhead, especially when used in lists or frequent re-renders.
**Action:** Always use the centralized `getCachedDateTimeFormat` and `getCachedNumberFormat` utilities in `src/lib/utils.ts` instead of directly instantiating `new Intl.DateTimeFormat` or `new Intl.NumberFormat`.
