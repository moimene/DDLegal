## 2024-05-24 - Intl instantiation bottleneck
**Learning:** `Intl.DateTimeFormat` and `Intl.NumberFormat` instances are expensive to create. The codebase frequently instantiates them inside utility functions (`formatDate`, `formatCurrency` in `src/lib/utils.ts`) and React components, causing them to be recreated on every render and slowing down large lists/tables.
**Action:** Always extract `Intl` formatters to the outer module scope as constants or cache them using a `Map` for dynamic parameters (e.g., currency) instead of instantiating them inline.
