## 2024-05-18 - Precise aria-controls for unmounted elements
**Learning:** Screen readers and accessibility tree tools report a warning when `aria-controls` points to an ID of an element that is currently unmounted (e.g., conditionally rendered via React). This creates confusion as the described target does not exist in the DOM.
**Action:** When implementing collapsible content that conditionally mounts/unmounts, explicitly set `aria-controls={condition ? targetId : undefined}` so the relationship is only established when the target actually exists.
