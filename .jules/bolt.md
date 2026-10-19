## 2024-05-24 - Intl Instantiation Bottleneck in React Renders
**Learning:** Instantiating new `Intl.DateTimeFormat` and `Intl.NumberFormat` objects inside utility functions (like `formatDate` or `formatCurrency`) causes performance bottlenecks when these functions are called frequently inside React render loops or when processing large data arrays.
**Action:** Extract static `Intl` instances to the module scope as constants, or use a caching mechanism (like a `Map`) for formatters with dynamic parameters (e.g., currency types), to ensure they are only instantiated once.
