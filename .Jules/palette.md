
## 2024-05-18 - Missing ARIA Controls in Custom Collapsible UI
**Learning:** Custom toggle buttons/collapsible components that conditionally unmount their content (like `sidebar.tsx` and `project-selector.tsx`) often lack `aria-controls` bindings. Furthermore, when the targeted content is unmounted, screen readers may be confused if `aria-controls` points to a non-existent DOM element ID.
**Action:** Use `React.useId()` to generate a unique base ID for the component, bind the trigger `<button>` with `aria-controls={isCollapsed ? undefined : targetId}` and add `id={targetId}` to the container. Setting it to `undefined` when collapsed/unmounted ensures screen readers do not attempt to look up missing IDs in the DOM.
