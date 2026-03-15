## 2026-03-15 - aria-controls requires element to be in DOM
**Learning:** When using `aria-controls` to link a toggle button with a collapsible panel, the target element (the panel) must remain in the DOM so the ID reference is valid. Unmounting the element entirely causes screen readers to find a broken reference.
**Action:** Use CSS visibility/display (like `display: 'none'` or Tailwind's `hidden`) rather than conditional rendering (unmounting) for the content targeted by `aria-controls`.
