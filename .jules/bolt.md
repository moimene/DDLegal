## 2024-06-07 - Preserving order in Maps with DESC arrays
**Learning:** When replacing `.find()` lookups on descending-ordered (DESC) arrays with Map-based O(1) lookups, instantiating the Map directly via `new Map(array.map(...))` causes older (subsequent) elements to overwrite newer (previous) ones, resulting in a regression.
**Action:** Always manually iterate over the array and conditionally set keys using `if (!map.has(key)) map.set(key, item)` to ensure the newest record is kept.
