## 2025-03-03 - Intl Formatters Bottleneck
**Learning:** `Intl.DateTimeFormat` and `Intl.NumberFormat` instantiations inside render loops and frequent functions create a performance bottleneck.
**Action:** Extract `Intl.*Format` to module scope constants or cache them using a `Map` for dynamic parameters like currencies.
