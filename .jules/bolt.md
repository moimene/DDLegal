## 2026-03-24 - Intl Formatter Instantiation Bottleneck
**Learning:** Instantiating `Intl.DateTimeFormat` and `Intl.NumberFormat` inside React components and loops is a significant performance bottleneck. These instances are expensive to create, and recreating them on every render or iteration wastes CPU cycles.
**Action:** Use a centralized caching mechanism (e.g., `new Map()`) in a shared utility file (like `src/lib/utils.ts`) that keys instances by `locale` and `JSON.stringify(options)`. Update all inline usages to call the caching functions instead.
