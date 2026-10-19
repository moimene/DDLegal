## 2024-05-14 - Missing ARIA Labels on Icon-only Close Buttons
**Learning:** Icon-only close buttons (like the `X` icon in modals/panels) often miss `aria-label` and `title` attributes, making them inaccessible to screen readers and lacking tooltip context for sighted users.
**Action:** When adding or reviewing modal/panel components, always verify that the close button has `aria-label="Cerrar"` and `title="Cerrar"`.
