
## 2024-05-18 - [Intl Formatter Caching]
**Learning:** Instantiating `Intl.DateTimeFormat` or `Intl.NumberFormat` repeatedly in loops or functional components is a significant performance bottleneck (can take over 40x longer than cached instantiations).
**Action:** Always use caching (e.g. `Map` based singletons like `getCachedDateTimeFormat` and `getCachedNumberFormat` in `src/lib/utils.ts`) instead of creating new `Intl` formatter instances to format dates, times, and currencies.
