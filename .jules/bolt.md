## 2024-05-18 - Caching Intl formatters
**Learning:** Frequent inline instantiations of `Intl.DateTimeFormat` or `Intl.NumberFormat` inside React components and array iterations (e.g. `map()`) degrade performance due to their high initialization overhead in JavaScript.
**Action:** Always create a caching utility or use centralized cached implementations (like `getCachedDateTimeFormat` using a JSON stringified cache key of the `options` object) to reuse these formatting instances.
