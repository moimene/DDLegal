## 2024-05-15 - [Backend Performance: Promise.all and .in() for Bulk Updates]
**Learning:** Found an N+1 query problem where database updates (`update()`) for breached SLAs were executed inside a `for...of` loop sequentially. While testing, realized Supabase supports a `.in()` filter that perfectly handles bulk updates.
**Action:** Replace `for` loops containing sequential `.update().eq()` calls with a single `.in()` filter grouped inside `Promise.all()` to dramatically reduce database round-trips from N+1 to 2.
