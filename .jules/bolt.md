## 2024-03-24 - Cached Intl Formatters
**Learning:** Instantiating `Intl.DateTimeFormat` and `Intl.NumberFormat` inside render loops/components causes them to be recreated on every render, becoming a severe performance bottleneck.
**Action:** Extract them to the outer module scope as constants, or cache them using a Map for dynamic parameters with `JSON.stringify(options)` as the cache key.
