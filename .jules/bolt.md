
## 2024-03-28 - Caching Intl formatter instances

**Learning:** `Intl.DateTimeFormat` and `Intl.NumberFormat` instantiation inside render loops or frequently called utility functions like `formatDate` and `formatCurrency` is a common performance bottleneck that causes unnecessary object creation.

**Action:** Extract these formatters out of the function scope, either by declaring them as constants at the module level or by caching them using a `Map` where the `JSON.stringify(options)` serves as the cache key.
