## 2026-04-11 - Dynamic aria-controls on unmounted components
**Learning:** In React components that conditionally unmount content (like a collapsible panel), pointing `aria-controls` to a static ID causes accessibility tools to look for a non-existent DOM element when the panel is collapsed.
**Action:** Set `aria-controls` to `undefined` when the target content is unmounted (e.g., `aria-controls={collapsed ? undefined : 'panel-id'}`) to dynamically manage the relationship without cluttering the accessibility tree with missing references.
