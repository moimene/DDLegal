## 2024-03-20 - Missing ARIA labels on Icon Buttons
**Learning:** Found several icon-only buttons missing aria-labels (like the logout button in user-indicator.tsx, or dismiss buttons in SmartSuggestions.tsx), which impacts screen reader accessibility. Adding them ensures all interactive elements are properly announced.
**Action:** Always verify icon-only buttons have descriptive `aria-label` attributes.
