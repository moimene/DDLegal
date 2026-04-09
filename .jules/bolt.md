## 2024-05-14 - Intl formatters optimization
**Learning:** Instantiating new `Intl.DateTimeFormat` or `Intl.NumberFormat` objects inside loops or frequently re-rendered components is a major performance bottleneck (can be 20x-50x slower).
**Action:** When caching formatting utilities like `Intl.DateTimeFormat` with varying options objects, `JSON.stringify(options)` provides a highly performant and reliable cache key, significantly outperforming inline instantiation. Or, create a singleton instance if the options are static.
