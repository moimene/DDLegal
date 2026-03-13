
## 2024-05-19 - Avoid reconstructing Intl.DateTimeFormat and Intl.NumberFormat in render loops
**Learning:** Instantiating `Intl.DateTimeFormat` or `Intl.NumberFormat` inside React components or render loops causes them to be recreated on every render, which is a significant performance bottleneck in Next.js applications, leading to CPU overhead and dropped frames in complex UI components.
**Action:** Extract `Intl.DateTimeFormat` and `Intl.NumberFormat` instances to the module scope outside functions/components. If dynamic parameters are required (e.g., dynamic currency codes), use a `Map` caching mechanism to avoid redundant instantiation.
