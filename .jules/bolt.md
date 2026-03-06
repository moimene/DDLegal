
## 2025-02-16 - [Intl Formatters Memory Bloat]
**Learning:** Instantiating `Intl.DateTimeFormat` or `Intl.NumberFormat` repeatedly inside React render loops or frequently called utility functions creates noticeable memory bloat and impacts render performance, because instantiating these classes is a heavy operation in V8/WebKit.
**Action:** Always extract `Intl.DateTimeFormat` and `Intl.NumberFormat` instances to module-scoped constants, or implement a Map-based cache for dynamic parameters (like currency types) in utility functions.
