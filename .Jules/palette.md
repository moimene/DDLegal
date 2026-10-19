## 2024-05-11 - Dynamic ARIA Controls for Collapsible Menus
**Learning:** Reacts `useId()` is crucial for managing ARIA relationships in dynamic UI elements (like maps generating multiple collapsibles) because hardcoded IDs cause collisions, and `aria-controls` must mirror DOM presence to avoid referencing non-existent elements when unmounted.
**Action:** When adding ARIA bindings to mapped collapsibles, conditionally unmount content and use `useId()` to dynamically scope `id`s (e.g., `${baseId}-${item.id}-panel`), only applying `aria-controls` when the panel is actually rendered in the DOM.
