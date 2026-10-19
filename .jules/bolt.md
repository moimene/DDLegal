## 2024-04-06 - Cache Intl.DateTimeFormat and Intl.NumberFormat instantiation
**Learning:** Instantiating `Intl` objects (like `Intl.DateTimeFormat` or `Intl.NumberFormat`) is surprisingly expensive in JS/V8, especially when triggered on every render in large lists.
**Action:** Always cache and reuse instances of `Intl` formatters, using serialized options as cache keys (e.g. `JSON.stringify(options)`).
