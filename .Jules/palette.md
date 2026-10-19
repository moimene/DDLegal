## 2024-04-13 - [A11y] Custom toggle buttons
**Learning:** Custom toggle buttons built with interactive elements should include `aria-pressed` (along with a descriptive `aria-label`) to correctly communicate their active/inactive state to screen readers, especially when visual cues (like color or icons) are the only indicators.
**Action:** Always include `aria-pressed={state}` on toggle buttons and ensure `aria-label` clearly describes the action that will occur if pressed (e.g. "Marcar como público").
