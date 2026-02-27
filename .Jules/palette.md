## 2024-11-20 - Palette Journal

**Learning:** Drag-and-drop zones often lack keyboard accessibility, making them unusable for users who cannot use a mouse.
**Action:** Always add `role="button"`, `tabIndex={0}`, and an `onKeyDown` handler (listening for Enter/Space) to make the drop zone interactive via keyboard, triggering the file selection dialog.
