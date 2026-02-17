# Cyto Web App — Visual Overhaul Prompts (Round 2)

## How to use these prompts
Run each prompt **one at a time** in Claude Code. After each one, verify the result in your browser (desktop + mobile). If something broke, tell Claude Code what went wrong before moving to the next prompt. **Do NOT run the next prompt until the current one is verified working.**

Between prompts, run `/clear` to start a fresh context.

---

## PROMPT 1: REVERT BROKEN VISUALS + FIX CORE BUGS

Read CLAUDE.md if it exists, then read these files to understand the current state:
- src/components/BubbleMap/BubbleMap.tsx
- src/components/BubbleMap/Bubble.tsx
- src/components/BubbleMap/ConnectionLines.tsx
- src/components/BubbleMap/useBubbleLayout.ts
- src/components/BubbleMap/BackgroundParticles.tsx
- src/components/MilestoneDetail/SubDetailView.tsx
- src/components/MilestoneDetail/MilestoneDetail.tsx
- src/components/MilestoneDetail/QuickStats.tsx
- src/components/UI/FloatingButton.tsx
- src/components/Settings/SettingsPanel.tsx
- src/App.tsx
- src/utils/blobPath.ts
- src/utils/metaball.ts
- src/styles/globals.css
- src/styles/theme.ts
- src/data/dependencies.ts
- src/stores/roadmapStore.ts (just the milestones and phases arrays)

CONTEXT: This app is a health recovery roadmap. The bubble map shows milestones as interactive blobs connected by organic membrane. Recent changes broke several things. I need you to fix the bugs first, then we'll do visual improvements in separate prompts.

PLAN FIRST — do not write code yet. Tell me your plan for each fix below, then I'll approve.

FIX 1 — REVERT BLOBS TO CIRCLES:
The current Bubble.tsx uses generateBlobPath() which produces ugly hexagonal shapes. Revert the milestone shapes to plain SVG circle elements. Remove the import and usage of blobPath.ts. Remove the motion.path morph animation. Use a simple circle with cx={0} cy={0} r={radius}. Keep the idle floating animation (the subtle x/y drift is good). Keep the fillColor and fillOpacity logic. Keep the onClick handler.

FIX 2 — REVERT CONNECTIONS TO SIMPLE LINES:
The current ConnectionLines.tsx uses metaballPath() which produces invisible/broken connections. Replace ALL connections with simple quadratic bezier curves for now (the Q path approach that's already there for blocked connections). Use a thicker strokeWidth of 3 for active connections, 1.5 for blocked. We will replace these with the gooey effect in a LATER prompt — do not try to implement gooey now.

FIX 3 — FIX MOBILE TOUCH PANNING:
Users cannot swipe/pan on mobile. The BubbleMap has touch-none CSS class AND custom touch handlers. The problem is the touch event handling conflicts. Fix: Keep touch-none on the container. In handleTouchMove, the e.preventDefault() should only fire when we're actually panning (hasPannedRef is true or distance > threshold). Also, the tap detection in handleTouchEnd needs to account for the container's getBoundingClientRect offset, not just raw clientX/clientY.

FIX 4 — FIX TAP-THEN-CLOSE BUG:
After tapping a milestone to open MilestoneDetail, clicking the X button breaks all further interaction. This is likely because the MilestoneDetail overlay is consuming/stopping events. Check if the issue is:
a) The overlay's AnimatePresence exit animation blocking pointer events
b) The BubbleMap's touch handlers not resetting state properly when the overlay closes
c) A React state issue where selectedMilestone doesn't properly clear
Debug by checking the uiStore.selectMilestone and deselectMilestone flow.

FIX 5 — REMOVE GHOST CHAT BUTTON:
There's a duplicate static chat button appearing behind the MilestoneDetail overlay (visible in the action items list). Find where a second chat button is being rendered inside the milestone detail or its children and remove it. The only chat button should be the one in App.tsx.

FIX 6 — REMOVE API KEY FROM SETTINGS:
In SettingsPanel.tsx, remove the Anthropic API key input field and its associated state/store logic. The agent handles this via OpenClaw, not the web app.

FIX 7 — STOP TEXT SHIFTING IN MENUS:
The SubDetailView.tsx has a breathing scale animation: scale: [1, 1.003, 1]. This causes text to visibly shift/jitter. Remove ANY scale animation from SubDetailView and MilestoneDetail. Only border-radius and box-shadow should animate on these overlays. The membrane-breathe CSS keyframes (border-radius morphing) is fine — keep that. But remove any Framer Motion scale transforms on overlay containers.

After planning all fixes, implement them. Then run: npm run typecheck && npm run build
Verify both pass clean.

---

## PROMPT 2: DETERMINISTIC LEFT-TO-RIGHT LAYOUT

Read CLAUDE.md if it exists, then read:
- src/components/BubbleMap/useBubbleLayout.ts
- src/components/BubbleMap/BubbleMap.tsx
- src/data/dependencies.ts

CONTEXT: The milestone map currently uses D3 force simulation with random initial positions, which means milestones end up in different spots every refresh. We need a deterministic left-to-right layout where:
- Phase 0 (Diagnostic Baseline) is on the far LEFT
- Phase 7 (Sustained Recovery) is on the far RIGHT
- The path winds organically between them (not a straight line)
- The dependency fork (Phase 2 -> Phase 3 + Phase 5) is visible as two branches
- The merge (Phase 3 + Phase 5 -> Phase 6) brings branches back together
- Positions are IDENTICAL every time the page loads
- On load: the view auto-zooms to the current milestone (Phase 0 right now)
- User swipes left/right to navigate the path

PLAN FIRST — do not write code yet.

THE LAYOUT ALGORITHM:
Replace the D3 force simulation entirely. Use pre-calculated, deterministic positions.

The dependency graph is:
ms-diagnostic-baseline -> ms-interpret-results -> ms-antibiotic-protocol -> ms-rebuild-gut -> ms-diet-expansion -> ms-expand-strengthen -> ms-sustained-recovery
                                                                        -> ms-confirm-progress (merges at ms-expand-strengthen)

This is a linear chain with one fork and merge. Lay it out as a winding horizontal path:

Step 1: Assign each milestone an ORDER value (0-7). For the fork, both branches get the same order range.
Step 2: X positions based on order. Spacing ~280px between milestones.
Step 3: Y positions using sine wave for organic vertical offset. Fork: offset branches vertically.
Step 4: FIXED coordinates. No simulation, no randomness.
Step 5: On load, animate milestones from slightly offset to final spots (~1 second settle).
Step 6: useBubbleLayout returns same positions every time for same viewport.
Step 7: Auto-zoom to current milestone (scale ~1.2) after settle animation.
Step 8: Total canvas ~3x viewport width. Vertical fits viewport height.

Implement. Change useBubbleLayout.ts, adjust BubbleMap.tsx for initial transform/auto-zoom.
Run: npm run typecheck && npm run build

---

## PROMPT 3: SVG GOO FILTER + ORGANIC CONNECTIONS

Read CLAUDE.md if it exists, then read:
- src/components/BubbleMap/BubbleMap.tsx
- src/components/BubbleMap/Bubble.tsx
- src/components/BubbleMap/ConnectionLines.tsx
- src/styles/globals.css

CONTEXT: We need organic, gooey connections between milestones. Two cells split apart but still connected by stretchy cytoplasm membrane. NOT thin lines. NOT dotted lines. NOT arcs. Thick, organic, gooey bridges.

THE TECHNIQUE — SVG Goo Filter:
1. Blur all elements in a group (feGaussianBlur)
2. Crank up alpha channel contrast (feColorMatrix)
3. Composite original sharp shapes back on top (feBlend)

The filter (place in defs inside main svg):
filter id="goo"
feGaussianBlur in="SourceGraphic" stdDeviation="10" color-interpolation-filters="sRGB" result="blur"
feColorMatrix in="blur" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7" result="goo"
feBlend in="SourceGraphic" in2="goo"

IMPLEMENTATION:
1. Add goo filter to defs in BubbleMap.tsx
2. Wrap milestones AND connections in single g with filter: url(#goo)
3. CONNECTIONS: Chain of small circles (r=6-8px) every ~20px between connected milestones. Same fill as source milestone. Reduced opacity for blocked (0.15 vs 0.5). Filter auto-merges them into membrane.
4. PULSING FLOW: On active connections, animate 2-3 small circles (r=4-5px) traveling source to target. Staggered delays, 3-4s duration, infinite repeat. Inside goo group so they merge with membrane.
5. BLOCKED connections: Same bridge circles, very low opacity (0.1), no pulse.
6. LABELS: OUTSIDE goo-filtered group. Second g layer on top (unfiltered) for text at milestone positions.
7. Remove old ConnectionLines.tsx approach, metaball.ts, blobPath.ts.

TUNING REFERENCE:
- stdDeviation="10": blur radius. Range 5-15. Higher = more goo, more CPU.
- "18 -7": contrast/threshold. "25 -10" for stronger, "12 -5" for subtle.
- Bridge spacing: 20px. Closer = thicker membrane.
- Bridge radius: 6-8px. Larger = thicker.

Implement. Run: npm run typecheck && npm run build

---

## AFTER THESE 3 PROMPTS

Screenshot (desktop + mobile):
1. Map zoomed out (full path)
2. Map zoomed into current phase
3. Close-up of connection between two milestones
4. Tapping milestone on mobile (open, close, touch still works?)

Prompts 4-6 will cover: button layout, background particles, progress indicators, location button, visual tuning.

---

## TECHNICAL REFERENCE

### SVG Goo Filter
```svg
filter id="goo"
  feGaussianBlur in="SourceGraphic" stdDeviation="10" color-interpolation-filters="sRGB" result="blur"
  feColorMatrix in="blur" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7" result="goo"
  feBlend in="SourceGraphic" in2="goo"

Apply to GROUP:
g filter="url(#goo)"
  circle cx="100" cy="100" r="50" fill="#E8B4A0"
  circle cx="120" cy="100" r="8" fill="#E8B4A0" (bridge)
  circle cx="140" cy="100" r="8" fill="#E8B4A0" (bridge)
  circle cx="200" cy="100" r="50" fill="#C8D5A0"

Labels OUTSIDE filtered group:
g
  text x="100" y="100" Phase 0
  text x="200" y="100" Phase 1
```

### Tuning Values
- stdDeviation 10: standard. 5-15 range.
- "18 -7": standard goo. "25 -10": stronger. "12 -5": subtle.
- Bridge spacing 20px. Closer = thicker.
- Bridge radius 6-8px.

### Dependency Graph
Order 0: ms-diagnostic-baseline
Order 1: ms-interpret-results
Order 2: ms-antibiotic-protocol
Order 3a: ms-rebuild-gut (upper branch)
Order 3b: ms-confirm-progress (lower branch)
Order 4: ms-diet-expansion (continues from 3a)
Order 5: ms-expand-strengthen (merge point)
Order 6: ms-sustained-recovery

### Files to clean up (delete after Prompt 3)
- src/utils/blobPath.ts
- src/utils/metaball.ts
- src/components/BubbleMap/BackgroundParticles.tsx (redo later)
