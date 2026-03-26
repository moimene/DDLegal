
## 2024-03-26 - Intl Formatters Cache
**Learning:** Instantiating `Intl.DateTimeFormat` and `Intl.NumberFormat` instances inside React render loops or frequently called utility functions is a significant performance bottleneck (e.g., ~10x slower than using a cached instance).
**Action:** Always extract `Intl` formatters to the outer module scope as constants, or cache them using a Map with `JSON.stringify(options)` as the key for dynamic parameters like currency.
