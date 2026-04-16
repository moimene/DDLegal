## 2024-06-25 - Use Cached Intl.DateTimeFormat and Intl.NumberFormat
**Learning:** Instantiating `new Intl.DateTimeFormat` or `new Intl.NumberFormat` inline during React renders or loops degrades performance significantly, especially when rendering lists of items or handling many requests on the server.
**Action:** Always use centralized caching functions like `getCachedDateTimeFormat` and `getCachedNumberFormat` in `src/lib/utils.ts` instead of inline instantiations to prevent unnecessary object creation overhead.
