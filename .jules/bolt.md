## 2024-05-24 - [Intl Formatters Performance Bottleneck]
**Learning:** Instantiating `Intl.DateTimeFormat` and `Intl.NumberFormat` instances repeatedly inside render loops or frequently called utility functions is a significant performance anti-pattern. These formatters are expensive to initialize.
**Action:** Extract `Intl` formatter instances to module-level scope to act as constants, or cache them (e.g., using a `Map` when dynamic arguments like `currency` are involved) so that instances can be reused rather than re-created on each call.
