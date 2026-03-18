## 2024-03-18 - Intl Object Caching
**Learning:** Instantiating `Intl.DateTimeFormat` or `Intl.NumberFormat` on every function call or render loop is incredibly slow compared to reusing an instance. Performance testing showed a ~6x speedup by caching the instance.
**Action:** When using `Intl` formatters, always extract them outside the component/function or cache them (e.g., using a Map) if parameters are dynamic.
