## 2024-04-17 - [Cache Intl Formatters]
**Learning:** Frequent instantiation of `Intl.DateTimeFormat` and `Intl.NumberFormat` (e.g. in list items or loops during rendering) has high initialization overhead, which can degrade frontend performance.
**Action:** Use a centralized cache (e.g. `Map`) using `JSON.stringify` on options as cache keys to reuse formatters instead of instantiating new ones.