# Architecture

## File Structure
src/
├── components/
│   ├── BubbleMap/
│   │   ├── BubbleMap.tsx          (Main container, zoom/pan, SVG filter defs)
│   │   ├── GooCanvas.tsx          (Canvas layer — goo connections)
│   │   ├── Bubble.tsx             (SVG layer — milestone nuclei)
│   │   ├── useBubbleLayout.ts     (Deterministic position calculator)
│   │   └── BackgroundParticles.tsx (Canvas ambient particles)
│   ├── MilestoneDetail/
│   │   ├── MilestoneDetail.tsx    (Detail panel container)
│   │   ├── SubDetailView.tsx      (Detail overlay — membrane-breathe)
│   │   └── QuickStats.tsx         (Stats display)
│   ├── UI/
│   │   └── FloatingButton.tsx     (Action buttons)
│   └── Settings/
│       └── SettingsPanel.tsx      (Settings panel)
├── styles/
│   ├── theme.ts                   (Color definitions)
│   └── globals.css                (CSS keyframes)
├── data/
│   └── dependencies.ts            (Milestone dependency graph)
├── stores/
│   └── roadmapStore.ts            (Zustand + Dexie persistence)
├── utils/                         (blobPath.ts and metaball.ts — DEPRECATED, do not use)
└── App.tsx
server/
└── index.ts                       (Hono — Railway deployment)

## Data Flow
- Roadmap data: Static config in dependencies.ts / roadmapStore
- User state: Zustand persisted to IndexedDB via Dexie (milestone status + logs)
- Agent sync: POST /api/state — agent reads for current phase

## Key Decisions
- Canvas for goo (performance), SVG for UI (crisp vectors)
- CSS keyframes for ambient animation (GPU, no JS loops)
- Deterministic layout (no D3 force simulation)
- Native touch handlers (Framer Motion drag doesn't work for map pan)

## Colors
- Cream background: #FFF5F2
- Button tints: Pastel variants of phase colors (Lavender, Mint, Yellow, Pink)
