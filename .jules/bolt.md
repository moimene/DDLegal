## 2024-03-20 - Intl Formatters Bottleneck
**Learning:** Instantiating `Intl.DateTimeFormat` and `Intl.NumberFormat` inside render loops or frequently called helper functions causes significant performance bottlenecks because these instances are expensive to create and are unnecessarily recreated on every render or function call.
**Action:** Always extract `Intl.*Format` instances to the outer module scope as constants, or cache them using a Map for dynamic parameters like currency.
