
## 2025-02-19 - Prevented Repeated Intl Formatters Instantiation
**Learning:** `Intl.DateTimeFormat` and `Intl.NumberFormat` instances are relatively expensive to create in JavaScript. When placed inside helper functions or components called frequently (e.g., inside maps or render loops), this leads to a measurable performance bottleneck.
**Action:** Always extract `Intl` formatters into module-scoped constants if the format options are static. If parameters are dynamic (like dynamic currency keys), implement a caching mechanism (e.g., a `Map`) to reuse formatter instances for repeated dynamic arguments.
