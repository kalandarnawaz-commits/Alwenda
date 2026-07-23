# Accessibility Review

Target: WCAG 2.2 AA where practical for the pilot.

## Findings

| Area | Severity | Finding | Recommendation |
| -- | -- | -- | -- |
| Modals/sheets | P2 | Custom bottom sheets and overlays need verified focus trap, Escape close, and focus restoration. | Add modal utility that sets `aria-modal`, traps focus, closes on Escape, and restores trigger focus. |
| Floating action buttons | P2 | Multiple icon-only controls rely heavily on visual meaning. | Ensure every icon button has an accessible name and visible focus state. |
| Custom clickable cards | P2 | Some cards use `article role="button"` or nested links/buttons. | Prefer real anchors/buttons; prevent nested interactive conflicts; add Enter/Space handling only when necessary. |
| Color-only status | P2 | Verified/live/status badges may rely on color. | Add text or accessible labels; ensure blue check has `aria-label`. |
| Error messages | P2 | Voice/microphone errors are visible, but screen-reader announcement behavior is not verified. | Use `role="alert"` or `aria-live="polite"` for permission and processing states. |
| Language | P2 | The HTML language and UI strings may not update fully when switching languages. | Confirm `<html lang>` and all visible strings update across routes. |
| Legal/auth forms | P2 | Some legal agreement text has inline buttons inside label-like text. | Ensure form controls have explicit labels and keyboard order is sensible. |

## Manual Checks

- Navigate every page with keyboard only.
- Zoom to 200%.
- Use VoiceOver/NVDA on auth, translation, marketplace detail, business claim, and Alwen.
- Verify focus does not fall behind open sheets.
