
## 2024-04-05 - Intl Object Instantiation Performance
**Learning:** Re-instantiating `Intl.DateTimeFormat` or `Intl.NumberFormat` on every function call (e.g., inside `formatDate` or `formatCurrency`) is computationally expensive and can become a bottleneck when rendering large lists or complex tables.
**Action:** Always cache these formatters globally or per-locale using a map with a uniquely stringified options key to prevent redundant object creation.
