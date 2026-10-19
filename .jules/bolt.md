## 2026-02-28 - [Intl.DateTimeFormat in React Renders]
**Learning:** Instantiating `Intl.DateTimeFormat` repeatedly inside a render loop (like a list mapping over events) is a significant performance bottleneck.
**Action:** Always extract `Intl.DateTimeFormat` instances to the module scope to reuse the instance, preventing costly re-initialization on every render.
