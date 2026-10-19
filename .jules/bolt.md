## 2024-05-24 - Intl instantiation bottleneck
**Learning:** `Intl.DateTimeFormat` and `Intl.NumberFormat` are surprisingly expensive to instantiate in JavaScript. When created inside React render loops or frequently called utility functions (like `formatDate` or `formatCurrency`), they cause significant CPU overhead and memory churn.
**Action:** Always extract `Intl` object instantiations to module scope constants. For functions accepting dynamic parameters (like currency codes), use a `Map` to cache the formatter instances so they are only instantiated once per parameter combination.
