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

- **ZERO SVG filters on the map.** No feTurbulence, no feDisplacementMap. These kill iPhone GPU performance when zoomed in.
- **ZERO Framer Motion on the map.** No motion.g, no animate, no SMIL. All milestone elements are static SVG.
- **Panning uses plain `<g transform>`.** Transform string set directly from React state.
- **Mouse/touch handlers use native addEventListener** with { passive: false }.
- **Zoom is cursor/pinch-anchored** — adjusts translation to keep point under cursor fixed.
- **Milestones have TWO layers:**
  1. OUTER MEMBRANE: Larger circle, low opacity (0.2) — rendered by ConnectionLines
  2. INNER CORE: Smaller circle (0.8× radius), higher opacity (0.55) — rendered by BubbleMap
- **Goo connectors use the Hiroyuki Sato metaball algorithm** with handleSize=3.5, v=0.65, maxDist=r1+r2+400. Filled with a linearGradient transitioning source→target color.
- **Buttons use membrane-breathe CSS animation** for organic blob shape and have a subtle pink tint (#FFE8E4).
- **Chat + Daily Log buttons are always visible.** Analytics bottom-left, Settings top-right (map view only).
- **Color theme:** Light mode background is #FFF5F2 (slight pink, not cream/peach).

## After Every Change
Always run: npm run typecheck && npm run build
Always push: git add -A && git commit -m "description" && git push origin main
