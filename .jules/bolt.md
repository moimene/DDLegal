## 2024-05-16 - O(N^2) Anti-Pattern in Deal Risk Score

**Learning:** When refactoring iterative `.map()` operations to single-pass loops, it's easy to accidentally miss deep `O(N^2)` anti-patterns such as `array.find()` inside the iteration, especially if the original implementation also did it. Also, when consolidating operations, avoid mutating arrays in place (e.g., using `sort()` without spreading `[...array]`), as it breaks original immutability guarantees.
**Action:** When finding bottlenecks, look deeply for nested operations like `.find()` inside mapping logic. When optimizing arrays and generating derived lists (like top 10 rankings), always use `[...array].sort()` to preserve ordering of original returned arrays.
