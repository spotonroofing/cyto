# Cyto Web App — Project Context

## What This Is
Cyto is a personal health recovery tracker with an organic, cellular visual theme. It visualizes a 7-phase recovery roadmap as a "microscope view" — milestone nodes are living cells connected by gooey cytoplasm bridges. Think agar.io meets a biology textbook.

## Tech Stack
- **Framework:** React (Vite) + TypeScript
- **Styling:** Tailwind CSS + globals.css (membrane-breathe keyframes)
- **State:** Zustand (roadmapStore) + Dexie (IndexedDB persistence)
- **Graphics:** Canvas (goo/connections) + SVG (nuclei, labels, buttons) — hybrid approach
- **Animation:** Framer Motion (interactions) + CSS keyframes (ambient breathing)
- **Server:** Hono on Railway (serves static build + /api/state endpoint)

## Key Files
- `src/components/BubbleMap/BubbleMap.tsx` — Main map container, zoom/pan state, SVG filter defs
- `src/components/BubbleMap/GooCanvas.tsx` — Canvas layer for goo connections (tapered filled paths)
- `src/components/BubbleMap/Bubble.tsx` — SVG layer for milestone nuclei + click handlers
- `src/components/BubbleMap/useBubbleLayout.ts` — Deterministic layout positions
- `src/components/MilestoneDetail/` — Detail overlay + panel
- `src/styles/theme.ts` — Central color definitions
- `src/data/dependencies.ts` — Milestone dependency graph
- `src/stores/roadmapStore.ts` — Zustand store (milestones, phases, user state)
- `server/index.ts` — Hono server

## Visual Design Rules
- Background: Cream #FFF5F2
- Cells have outer membrane (CSS border-radius morphing animation) and inner nucleus
- Connections are thick organic "goo" — NOT thin lines, NOT dots, NOT arcs
- Button tints: pastel variants of phase colors
- Labels go OUTSIDE any SVG goo filter group (blur destroys text)
- Mobile-first — everything must work on phone

## Architecture Decisions
- **Canvas for goo, SVG for UI:** Canvas handles high-particle-count goo rendering + blur filters efficiently. SVG keeps nuclei/text/buttons crisp.
- **CSS keyframes for ambient animation:** Membrane breathing is pure CSS (GPU accelerated). No JS animation loops for constant effects.
- **Deterministic layout:** Milestone positions are pre-calculated, not D3 force simulation. Same positions every load. Current layout: left-to-right winding path with fork/merge.
- **No scale animations on overlays:** Scale transforms on SubDetailView/MilestoneDetail cause text jitter. Only border-radius and box-shadow animate.
- **Native touch handlers:** Framer Motion drag conflicted with pan/zoom. Using native addEventListener with passive: false on a plain <g>, not motion.g.
- **Goo connections:** Canvas with tapered filled paths (the v8 approach).
- Daily logging is available in-app but primarily done via the Telegram agent.

## Things NOT To Do
- Do NOT use generateBlobPath / blobPath.ts — produces hexagonal shapes. Use plain circles.
- Do NOT use metaballPath / metaball.ts — produces invisible connections.
- Do NOT apply SVG goo filter to individual elements — must be on a <g> group.
- Do NOT put text/labels inside the goo-filtered group — blur destroys them.
- Do NOT use feTurbulence for cell shapes — kills mobile performance (15fps).
- Do NOT add Framer Motion scale transforms to overlay containers.
- Do NOT use D3 force simulation for layout — causes random positions on each load.

## PowerShell Note
`bundle-for-review.ps1` runs under Windows PowerShell 5.1: no literal `"` inside `-ArgumentList @()`; `ConvertTo-Json` wraps bare arrays in `{value:[...],Count:N}` (serialize per-item and join); non-ASCII chars in a BOM-less `.ps1` silently break parsing (stick to ASCII or add a BOM).

## Reference Docs
- `docs/WEB_APP_SCOPE.md` — Full feature inventory with status markers
- `docs/APPROACHES_TRIED_ARCHIVE.md` — CRITICAL: Every technique tried, what failed, and why
- `docs/WEB_APP_ARCHITECTURE.md` — File structure, data flow, technical decisions
- `docs/WEB_APP_KNOWN_BUGS.md` — Current bug list
- `docs/WEB_APP_FUTURE_IDEAS.md` — Backlog of v2+ ideas
- `docs/VISUAL_OVERHAUL_PROMPTS.md` — Pre-written prompt sequence for visual improvements (DO NOT run unless Willem says to)
- `docs/WILLEM_CONTEXT.md` — Health context (for understanding what the milestones represent)
- `docs/FEATURE_ARCHITECTURE.md` — Data models, rendering pipeline, UI structure, state management. Read before planning a new feature.
- `docs/SPEC.md` — the original spec; `docs/CYTO_WEBAPP_PLAN.md` — the web-app plan; `docs/GOO_SDF_DESIGN.md` — the SDF goo design notes (with a working snapshot in `docs/goo-backups/`)
