1. **Implement Cached Formatters in `src/lib/utils.ts`**
   - Create `getCachedDateTimeFormat` using `Intl.DateTimeFormat` and a Map for caching.
   - Create `getCachedNumberFormat` using `Intl.NumberFormat` and a Map for caching.
   - Use `JSON.stringify` on options as cache keys, as it is performant and reliable.
   - Update `formatDate` and `formatCurrency` in `src/lib/utils.ts` to use these cached versions.

2. **Refactor Codebase to use Cached Formatters**
   - Find all instances of `new Intl.DateTimeFormat` and `new Intl.NumberFormat` in `src/`.
   - Replace them with the `getCachedDateTimeFormat` and `getCachedNumberFormat` utilities or import and use them appropriately.

3. **Verify Functionality**
   - Run linter and tests to ensure no regressions occur.
   - Update `.jules/bolt.md` if this specific insight hasn't been logged yet.

4. **Complete pre-commit steps**
   - Complete pre-commit steps to ensure proper testing, verification, review, and reflection are done.

5. **Submit PR**
   - Create a PR with title "⚡ Bolt: [performance improvement]" and required description format.
