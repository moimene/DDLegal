## 2024-05-24 - [Intl Formatters Performance Overhead]
**Learning:** Instantiating `new Intl.DateTimeFormat` and `new Intl.NumberFormat` repeatedly (e.g., inside list item renders or loops) is surprisingly expensive and can lead to significant main-thread blocking and re-render delays.
**Action:** Always create and use centralized caching utility functions (like `getCachedDateTimeFormat` and `getCachedNumberFormat`) to memoize the `Intl` formatter instances based on locale and options, avoiding redundant initializations.
