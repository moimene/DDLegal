## 2024-05-26 - O(N²) array lookups in iterators
**Learning:** Calling `Array.prototype.find()` inside a loop that iterates over a corresponding mapped array introduces an O(N²) performance bottleneck. This often happens when associating items from mapped/filtered arrays back to their original counterparts.
**Action:** Since both arrays represent the same elements in the same order, use an indexed loop `for (let i = 0; i < array.length; i++)` to map both the new value `array[i]` and the original value `originalArray[i]` in O(N) time.
