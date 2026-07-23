# Visual Review

## Breakpoints Required

Test at 320, 375, 390, 430, tablet portrait, tablet landscape, 1024, 1280, 1440 and large desktop.

## Observations

| Area | Issue | Severity | Recommendation |
| -- | -- | -- | -- |
| Mobile Home | Header/wordmark can feel oversized and close to the hero edge. | P2 | Cap `.brand-wordmark` and apply safe mobile padding inside hero/header. |
| Floating controls | Alwen orb, TYT orb, translate mic and bottom nav can compete for the same lower-right screen area. | P2 | Use a single floating zone manager with reserved content padding and per-view collision rules. |
| Marketplace rails | Horizontal shelves are visually strong but need consistent arrow/swipe affordance and final-card padding. | P2 | Keep scroll-snap, card min widths, and right padding so the last card can fully settle. |
| Translation | Premium surface exists, but mobile voice panels can be tall enough to hide the output behind fixed controls. | P2 | Move playback/mic controls into the card flow and reserve bottom safe-area spacing. |
| Profile | Visual identity is richer than before, but verification/trust claims must map to real backend status. | P2 | Avoid high-trust visual badges without source-backed state. |
| Ops/admin | Operations screen can look like raw controls and should not be public-facing. | P1 | Hide from production public shell or require admin role before rendering. |

## Visual Acceptance Criteria

- No body-level horizontal scroll at any audited breakpoint.
- Fixed controls never cover primary CTA buttons, card footers, or form inputs.
- Every bottom nav item is equal height and touch target is at least 44 px.
- Wordmark is never stretched, cropped, or recreated.
- Cards use consistent radius, image aspect ratio, and action placement.
- Dark/light theme maintains AA contrast.
