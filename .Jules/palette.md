## 2024-03-20 - Palette initialized

## 2024-03-20 - Adding `aria-controls` bindings with matching `id` attributes
**Learning:** Collapsible groups lack proper aria-controls binding. Using useId inside loops violates hooks rules, so a fallback to a stable unique string from the object is a good pattern.
**Action:** When creating collapsible panels, always ensure `aria-controls` is set on the toggling button and references a stable ID on the target content container. Use React `useId()` when possible, or stable keys like `group.id` with a prefix inside loops. Add CSS `hidden` / `block` for visibility instead of unmounting so `aria-controls` references an existing element.
