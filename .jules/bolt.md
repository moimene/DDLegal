
## 2024-03-24 - Intl Formatter Bottleneck Optimization
**Learning:** Instantiating `Intl.DateTimeFormat` or `Intl.NumberFormat` inline in render-heavy loops (like timeline components or list renderers) causes a measurable performance bottleneck (~100x slower than cached execution) because these APIs are inherently expensive to configure.
**Action:** Always extract `Intl` formatter instantiations out of the render loop. If format options vary dynamically, employ a cache keyed by a serialized options string (e.g., `JSON.stringify(options)`) to reuse instances.
