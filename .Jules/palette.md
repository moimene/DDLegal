## 2026-04-05 - Adding ARIA attributes to collapsible React components
**Learning:** When using React components to conditionally render DOM elements for a collapsible panel, it's vital to unset `aria-controls` (`undefined`) when the content unmounts to prevent pointing to a non-existent DOM ID while keeping the button's toggle logic properly accessible.
**Action:** Use `useId()` to securely pair `aria-expanded` with `aria-controls`, and always unset `aria-controls` if the content block is conditionally removed from the DOM.
