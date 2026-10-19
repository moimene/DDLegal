
## $(date +%Y-%m-%d) - CSS-based visibility over conditional rendering for collapsible panels
**Learning:** React's conditional rendering (unmounting) removes elements from the DOM. If `aria-controls` on a toggle button points to an element ID, and that element is unmounted, the `aria-controls` attribute becomes invalid/dangling for screen readers, breaking accessibility.
**Action:** When creating custom collapsible components (like accordion items or sidebar group panels), always use CSS properties (like `display: none` or Tailwind's `hidden`) combined with a matching `id` instead of conditionally unmounting the component, ensuring `aria-controls` references an element that always exists in the DOM.
