## 2024-05-23 - Interactive Trees Need Proper Buttons
**Learning:** Found an accessibility issue pattern in folder trees (`src/components/vdr/FolderTree.tsx`) where expand/collapse toggles are implemented using `<span>` with `onClick` handlers. These lack proper semantics, `aria-expanded`, and `aria-label` attributes, making them inaccessible to keyboard and screen reader users.
**Action:** Replace `<span>` toggles in tree structures with `<button type="button">` and include `aria-expanded` and `aria-label` attributes to ensure keyboard and screen reader accessibility.
