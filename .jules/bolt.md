## 2024-05-24 - Intl Formatter Caching
**Learning:** Instantiating `Intl.DateTimeFormat` or `Intl.NumberFormat` on every call, especially inside utility functions or render loops, causes performance bottlenecks since these are expensive to create.
**Action:** Always cache these formatters. If they are created inside utility functions, use a `Map` caching mechanism where the key is a stringified version of the options, ensuring the formatters are reused.
