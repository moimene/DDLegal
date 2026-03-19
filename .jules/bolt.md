## 2024-05-24 - Cache Intl formatters
**Learning:** Instantiating `Intl.DateTimeFormat` and `Intl.NumberFormat` inside React render loops or frequently called utility functions is a significant performance bottleneck due to the high cost of initializing these objects in V8/JavaScript.
**Action:** Always extract `Intl` formatter instances to the outer module scope as constants, or cache them using a `Map` when dynamic parameters (like currency codes) are required.
