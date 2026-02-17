# Known Bugs

## Visual / UI
1. **Settings button invisible** — Low contrast or z-index conflict in top-right. FloatingButton.tsx / App.tsx. Fix attempted in v8, needs verification.
2. **Analytics button cut off** — bottom-6 class vs mobile safe areas. Fix attempted in v8.
3. **Goo connections look like "umbilical cords"** — curveBow too high. GooCanvas.tsx. Addressed in v8.
4. **Bridge dots visible as individual circles when zoomed** — Blur radius too small vs spacing. Switched to filled paths in v8.

## Interaction
5. **Tap-then-close bug** — Tapping milestone then closing detail breaks all interaction. Likely AnimatePresence exit blocking pointer events or touch handler state not resetting.

## Performance
6. **Mobile zoom/pan performance** — Mitigated by removing feTurbulence and using Canvas. May need further optimization.
