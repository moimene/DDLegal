## 2026-05-09 - Parallelize Frontend API Requests
**Learning:** Found an N+1 blocking network request pattern in frontend components when dispatching multiple API calls (e.g. bulk archiving documents). Awaiting fetch sequentially inside loops blocks the UI.
**Action:** Use `Promise.all(items.map(item => fetch(...)))` to send network requests concurrently for significant latency reduction.
