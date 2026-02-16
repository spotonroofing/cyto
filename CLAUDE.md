\# Cyto — Personal Health Recovery Tracker



\## What This Is

\*\*Cyto\*\* is a personal-use-only interactive health recovery web app for a single user (Willem). The name comes from "cytoplasm" — the living substance inside every cell — which captures what this app is: a living, breathing command center for health recovery. Cyto works as both the app brand ("Cyto — your living health dashboard") and the AI coach character ("Cyto noticed you skipped lunch"). It visualizes a multi-phase gut health recovery roadmap as an organic bubble/node map with smooth animations, AI-powered nudges via Anthropic API, daily logging, and analytics dashboards. It connects to an OpenClaw agent on Telegram for proactive notifications.



\## Tech Stack

\- React 18+ with TypeScript

\- Vite for build tooling

\- Tailwind CSS for utility styling + custom CSS for animations/gradients

\- Framer Motion for all animations and transitions

\- D3.js for the bubble map layout and force simulation

\- Recharts for analytics charts

\- Anthropic API (Claude Opus 4.6) for Cyto AI coach features

\- LocalStorage + IndexedDB for persistent client-side data (no backend database)

\- Railway for deployment



\## Project Structure

src/

├── components/

│   ├── BubbleMap/        # Main bubble visualization + force layout

│   ├── MilestoneDetail/  # Expanded milestone view (checklist, notes, stats)

│   ├── Analytics/        # Charts, trends, heat maps

│   ├── Chat/             # Cyto in-app AI chat interface

│   ├── Settings/         # Theme toggle, API key input, data export

│   └── UI/               # Shared animated components (floating panels, transitions)

├── data/

│   ├── roadmap.ts        # All milestone/phase/action item data

│   ├── dependencies.ts   # Which milestones block which downstream milestones

│   └── healthContext.ts  # Willem's health context (editable by Cyto AI)

├── hooks/                # Custom React hooks for animations, data, Cyto AI

├── stores/               # State management (Zustand)

├── styles/               # Global styles, theme definitions, animations

├── utils/                # Date math, dependency graph logic, Cyto AI prompt builders

└── types/                # TypeScript interfaces



\## Code Style

\- Functional components only, no class components

\- Use Zustand for state management, not Redux or Context API

\- All animations via Framer Motion — no CSS transition hacks

\- Tailwind for layout/spacing, custom CSS only for complex gradients and organic shapes

\- TypeScript strict mode, no `any` types

\- ES modules (import/export), destructured imports

\- All components must be responsive (mobile-first, works on phone and desktop)



\## Design Principles

\- Organic, amoeba-like visual language — no sharp rectangles or rigid grids

\- The app IS Cyto — a living organism. The UI should feel like Cyto is alive, not a static dashboard

\- Pastel rainbow palette across both light and dark themes

\- Elements float and breathe — subtle idle animations on everything visible

\- Transitions between views are smooth zooms/morphs, never hard cuts

\- UI panels appear as floating organic shapes, not fixed modal boxes



\## Key Behaviors

\- Bubble map is the home view — centered on current/active milestone

\- Tapping a bubble zooms into it smoothly, revealing details

\- Sub-stats within a milestone can "break off" as smaller bubbles (amoeba split)

\- Timeline adjusts dynamically based on completion — dependency-aware, not rigid

\- AI chat is accessible from within the app — Cyto is the coach character, sharing context with the OpenClaw/Telegram agent

\- Dark/light mode toggle with pastel color themes for both



\## Commands

```bash

npm run dev        # Start dev server

npm run build      # Production build

npm run preview    # Preview production build

npm run lint       # ESLint

npm run typecheck  # TypeScript checking

```



\## Important Notes

\- This is a SINGLE USER app. No auth, no multi-user, no login screens.

\- All data persists client-side (IndexedDB + localStorage). No backend DB.

\- The Anthropic API key is entered in settings and stored locally. Never hardcode it.

\- When deploying to Railway, it's just a static site build (Vite output).

\- Mobile responsiveness is critical — primary use is on phone.

\- Never add features not in the spec. Ask before adding anything new.

\- Do not refactor code unless explicitly asked.

## Visual Architecture

### Two-Layer Cell Rendering
Each milestone is rendered with two visual layers to create an organic cell look:
1. **Membrane layer** — GooCanvas (`<canvas>`) at CSS `opacity: 0.28`. Draws full-size milestone circles + animated bridge circles through the SVG goo filter. This creates a translucent, blobby outer membrane.
2. **Nucleus layer** — SVG overlay circles at `r = radius * 0.72` and `fillOpacity: 0.5`. These sit inside the membrane, giving each cell a denser inner core.

### Goo Rendering (Canvas + SVG Filter)
The gooey organic effect uses the **blur + alpha contrast** technique:
1. **GooCanvas** (`<canvas>`) draws milestone circles + animated bridge circles
2. CSS `filter: url(#goo-filter)` + `opacity: 0.28` applied to the canvas
3. Filter chain: `feGaussianBlur(stdDeviation=12)` → `feColorMatrix(alpha×22-9)` → `feBlend(SourceGraphic)`
4. Where circles overlap, their blurred alpha halos merge past the threshold → organic gooey merging
5. Bridge circles spaced every 18px, oscillating perpendicular to connection paths → flowing liquid movement

### SVG Overlay (Nucleus + Labels)
A separate SVG sits on top of the canvas (z-index 2). It contains:
- Nucleus circles (72% radius, fillOpacity 0.5)
- Dashed rings for locked phases
- Click targets (transparent circles)
- Phase name + number labels
- The nucleus circles provide the denser inner core of each cell

### Why Canvas, Not SVG
SVG filter on a `<g>` group re-rasterizes every frame when child elements animate. Canvas composites all circles into a single raster, then the filter runs once on that raster. ONE filter pass per frame vs N.

### Performance
- Canvas draws circles at fixed 18px spacing per connection
- devicePixelRatio capped at 2
- feGaussianBlur stdDeviation=12 is moderate (GPU-accelerated separable blur)
- Canvas at opacity 0.28 means membrane is subtle, nucleus carries the visual weight
- No feTurbulence, no animated seed, no SMIL on filter params

### Tuning the Goo
- **Softer goo**: Lower the `22` in feColorMatrix alpha row (e.g., 15) or increase stdDeviation
- **Sharper goo**: Raise the `22` (e.g., 25) or decrease stdDeviation
- **Thicker connections**: Increase bridge circle `baseR` or `midR` (currently smallerR * 0.28)
- **More flow**: Increase `amplitude` in bridge circle oscillation
- **Less flow**: Decrease `amplitude` or `speed`

### Cell-Styled Buttons
Each FloatingButton has two `<span>` layers mimicking the cell look:
- Outer membrane span: full inset, phase color at opacity 0.2, membrane-breathe animation
- Inner nucleus span: inset 15%, phase color at opacity 0.45
- Each button receives a unique `phaseColor` prop from the phase palette

### TypewriterTerminal
Top-left overlay that types messages character-by-character with variable speed.
JetBrains Mono font, 0.55 opacity, muted purple prompt character, blinking cursor.

### Other Notes
- **Panning uses plain `<g transform>`.** No Framer Motion on the map.
- **Mouse/touch handlers use native addEventListener** with { passive: false }.
- **Zoom is cursor/pinch-anchored.**
- **Locked phases** get a dashed stroke ring on the SVG overlay (not dimmed).
- **Background:** #FFF8F7 base, radial vignette overlay, muted pink-mauve particles.
- **Color:** cream = #FFF8F7 throughout. No warm peach/orange tones.
- **ConnectionLines.tsx was deleted** — GooCanvas replaces it entirely.

## After Every Change
Always run: npm run typecheck && npm run build
Always push: git add -A && git commit -m "description" && git push origin main
