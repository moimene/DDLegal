## 2024-04-11 - Prevent High Initialization Overhead from Intl Formats
**Learning:** Instantiating `Intl.DateTimeFormat` and `Intl.NumberFormat` repeatedly in React components during rendering or inside loops can cause measurable performance degradation due to high initialization overhead.
**Action:** Use centralized `getCachedDateTimeFormat` and `getCachedNumberFormat` utilities in `src/lib/utils.ts` utilizing a `Map` with `JSON.stringify(options)` as the cache key to dramatically speed up formatting.
