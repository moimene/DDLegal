## 2024-05-18 - Fix FolderTree Accessibility
**Learning:** Found a common accessibility anti-pattern in the VDR folder tree where an interactive `<button>` (the folder) nested another interactive toggle (the chevron). Also noted that all UI text and labels should strictly remain in Spanish as per the current codebase localization.
**Action:** Replaced nested buttons with a `div role="button"` structure and added appropriate Spanish ARIA labels. Will look out for this nesting pattern in future components.
