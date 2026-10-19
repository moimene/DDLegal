## 2024-05-15 - Map Creation on DESC Sorted Arrays
**Learning:** When replacing `.find()` lookups on descending-ordered arrays with Map-based O(1) lookups to improve performance, do not instantiate the Map using `new Map(array.map(...))` because it iterates sequentially, causing older (later in array) elements to overwrite newer (earlier) ones, resulting in a regression.
**Action:** Always manually iterate over the array and conditionally set keys only if they do not already exist (`if (!map.has(key)) map.set(key, item)`).
