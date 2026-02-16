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

## Visual Implementation Notes

- **Panning uses plain `<g transform>`, NOT Framer Motion `motion.g`.** Framer Motion's animate/transition system fights with manual transform updates and breaks pan/drag. The transform string is set directly from React state on every mouse/touch move.
- **Mouse and touch handlers use native `addEventListener`** with `{ passive: false }`. React synthetic events don't support passive:false (needed for preventDefault on mobile). Mouse listeners for move/up are on `window` so dragging works when cursor leaves the container.
- **The SVG element has `pointerEvents: 'none'`** so mouse events pass through to the container div. Interactive elements inside (Bubble click targets) have `pointerEvents: 'auto'`.
- **Milestone connections use the Hiroyuki Sato metaball algorithm** (from Paper.js / varun.ca/metaballs). This generates filled SVG path geometry that forms organic membrane shapes between circles — real goo, not filter hacks or stroked lines. The maxDist threshold is `radius1 + radius2 + 350` to ensure connections appear at the deterministic SPACING of 280px. The path is filled with a linearGradient that transitions between source and target milestone colors.
- **Milestone circles have an `feTurbulence` + `feDisplacementMap` filter** that makes their edges wobble organically like cell membranes. The turbulence seed is STATIC (not animated) — animated seeds regenerate Perlin noise every frame and kill mobile GPU performance.
- **Milestone shapes use `blobPath()` with SMIL `<animate>` on the `d` attribute** for organic blob morphing. Three blob variants are generated per milestone with different seeds/variance and interpolated in a 10s loop. The same blobPath function is used in both BubbleMap.tsx (filled shapes) and Bubble.tsx (transparent click targets).
- **Zoom is cursor-anchored** (desktop) and **pinch-anchored** (mobile). The math adjusts translation so the point under the cursor/fingers stays fixed during scale changes.
- **Labels render in a separate unfiltered group** above the wobbled milestone circles so text stays sharp.
- **Bubble.tsx uses plain `<g transform>` with no Framer Motion.** Click targets are blob paths with SMIL morphing animation, not circles.
- **Buttons use `membrane-breathe` CSS animation** for organic border-radius morphing. Chat and log buttons are persistent (always visible unless their panel is open). Other buttons only show on the map view.
- **Do NOT use Framer Motion for the pan/zoom transform group.** This has caused panning bugs across multiple iterations.
- **Do NOT animate the feTurbulence seed.** This has caused mobile performance issues across multiple iterations.

## After Every Change
Always run: npm run typecheck && npm run build
Always push: git add -A && git commit -m "description" && git push origin main
