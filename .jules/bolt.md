## 2025-02-28 - Intl Instantiation Overhead Optimization
**Learning:** Instantiating `new Intl.DateTimeFormat` and `new Intl.NumberFormat` repeatedly in React component render functions or tight loops creates a measurable performance bottleneck due to the high initialization overhead of the Intl API.
**Action:** Created `getCachedDateTimeFormat` and `getCachedNumberFormat` in `src/lib/utils.ts` and replaced all inline instantiations across the app. Always use these cached formatters instead of `new Intl.*` going forward.
