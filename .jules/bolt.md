
## 2025-02-17 - Prevent repetitive Intl formatter instantiation
**Learning:** Instantiating `Intl.DateTimeFormat` or `Intl.NumberFormat` repeatedly inside React render loops or frequently called format functions causes unnecessary overhead.
**Action:** Extract to module scope or cache the instances using a `Map`. When caching formatters with dynamic configuration (like different currency codes or precision), use `JSON.stringify(options)` as the cache key to maintain high performance without sacrificing flexibility.
