# CYTO — Web App Project Plan

Generated: February 19, 2026

This document catalogs the Cyto web app — what exists today and what is planned. Intended as a reference for a coding agent to build from.

A separate AI agent (OpenClaw on Telegram) exists and connects to this web app via REST API. The agent is NOT covered in this plan, but every integration point where the web app needs to serve or accept data from the agent IS documented.

NOTE ON TECH STACK: The frontend is React 18 + TypeScript + Vite. Every component uses React hooks. package.json lists react/react-dom as dependencies. vite.config.ts uses @vitejs/plugin-react.

---

## 1. Current Implementation (What Exists Today)

### 1.1 Project Structure and Build Setup

Tech stack (from source):
- React 18.3 + TypeScript 5.7 (Vite 6.1 bundler)
- Tailwind CSS 3.4 for utility classes
- Zustand 5.0 for state management
- Dexie 4.0 (IndexedDB wrapper) for client-side persistence
- Framer Motion 11.18 for UI animations
- Recharts 2.15 for chart rendering
- D3 7.9 (imported but used minimally — no force simulation)
- Canvas (goo rendering) + SVG (labels/click targets) hybrid graphics

Files:
- `package.json` — dependencies, scripts (dev, build, preview, lint, typecheck, start, server:dev)
- `vite.config.ts` — React plugin, @ alias to src/, /api proxy to localhost:3000, manual chunks for framer-motion/recharts/d3
- `tailwind.config.ts` — Custom fonts (Inter, Space Grotesk, JetBrains Mono), phase colors (light + dark), theme colors (cream, navy, charcoal, gold, copper, done colors)
- `tsconfig.json` — TypeScript config
- `index.html` — Entry point, Google Fonts preconnect, viewport meta with user-scalable=no

Build: `tsc -b && vite build`
Dev: `vite` (frontend) + `cd server && npm run dev` (backend)
The vite config proxies /api to localhost:3000 in dev mode.

Server directory: Referenced in package.json scripts (`cd server && npm run start`) and CLAUDE.md (`server/index.ts — Hono server`). [REFERENCED BUT NOT FOUND IN UPLOADED SOURCE — server/ directory was not included in the upload]

### 1.2 Data Model

File: `src/types/index.ts`

Phase: id, name, color, darkColor, defaultStartOffset (days), defaultDuration (days)

ActionItem: id, phaseId, milestoneId, title, description?, completed, completedDate?, dueDate?, blocksDownstream, dependsOn (string[]), category (test|medication|supplement|diet|lifestyle|peptide|consultation), foodTrial? (food, tier, outcome?)

Milestone: id, phaseId, title, description, actionItemIds (string[])

DailyLog: date (YYYY-MM-DD), energy (1-10), fog (1-10), mood (1-10), sleep (1-10), flare (boolean), flareSeverity? (1-5), flareTrigger?, weight? (lbs), foods (string[]), notes, timestamp

ChatMessage: id, role (user|assistant), content, timestamp, milestoneContext?, actions? (RoadmapAction[])

RoadmapAction: action (add_item|remove_item|complete_item|update_date|add_note), target (item ID), data (Record)

MilestoneStatus (derived): not_started | in_progress | completed | overdue | blocked

BubblePosition: x, y, radius

ViewState: map | milestone | log | analytics | chat | settings

### 1.3 Roadmap Data (Static)

File: `src/data/roadmap.ts` (971 lines)

8 phases defined:
- Phase 0: Immediate (offset 0, duration 7 days)
- Phase 1: Assess + Decide (offset 7, duration 8 days)
- Phase 2: Eradication (offset 15, duration 14 days)
- Phase 3: Restoration (offset 29, duration 21 days)
- Phase 4: Food Reintroduction (offset 50, duration 42 days)
- Phase 5: Retest + Reassess (offset 78, duration 14 days)
- Phase 6: Optimization (offset 92, duration 90 days)
- Phase 7: Maintenance (offset 182, duration 180 days)

8 milestones: ms-diagnostic-baseline, ms-interpret-results, ms-antibiotic-protocol, ms-rebuild-gut, ms-diet-expansion, ms-confirm-progress, ms-expand-strengthen, ms-sustained-recovery

78 total action items across all milestones. Categories include medication starts, lab orders, food trials (26 items in ms-diet-expansion with food/tier/outcome tracking), supplement protocols, lifestyle items.

Action items are defined as static defaults in roadmap.ts. Completion state is stored separately in IndexedDB (see 1.5).

### 1.4 Dependency Graph

File: `src/data/dependencies.ts`

Phase dependencies: linear chain phase-0 through phase-7, except phase-5 depends on phase-2 (not phase-4), and phase-6 depends on both phase-4 and phase-5 (merge point).

Milestone dependencies (defines the map topology):
- ms-diagnostic-baseline -> ms-interpret-results -> ms-antibiotic-protocol
- ms-antibiotic-protocol forks to: ms-rebuild-gut AND ms-confirm-progress
- ms-rebuild-gut -> ms-diet-expansion -> ms-expand-strengthen
- ms-confirm-progress -> ms-expand-strengthen (merge)
- ms-expand-strengthen -> ms-sustained-recovery

This creates a left-to-right path with one fork after Phase 2 and one merge at Phase 6.

### 1.5 Database Layer

File: `src/lib/db.ts`

Uses Dexie (IndexedDB). Database name: `cytoDB`. Version 1.

Tables:
- `dailyLogs` — keyed by date, indexed on timestamp
- `chatMessages` — keyed by id, indexed on timestamp and milestoneContext
- `actionItemStates` — keyed by id (stores completion overrides for static action item defaults)
- `milestoneNotes` — keyed by id, indexed on milestoneId and timestamp

Additional stored types (not in types/index.ts):
- StoredActionItemState: id, completed, completedDate?, notes?, foodTrialOutcome?
- StoredMilestoneNote: id, milestoneId, content, timestamp

Design: Static action item definitions live in roadmap.ts. User progress (completion, food trial outcomes) is stored as overlay records in IndexedDB. The store merges them at read time.

### 1.6 State Management

5 Zustand stores:

`src/stores/roadmapStore.ts` — Core data store. Merges static roadmap data with IndexedDB overrides. Provides: toggleActionItem, setFoodTrialOutcome, addMilestoneNote, deleteMilestoneNote. Derived getters: getActionItem, getActionItemsForMilestone, getMilestoneProgress, getMilestoneStatus, getNotesForMilestone, getOverallProgress, getPhaseProgress, getCurrentMilestone. Calls syncStateToServer() after every mutation.

`src/stores/dailyLogStore.ts` — DailyLog CRUD. saveLog auto-saves and calls syncStateToServer(). getRecentLogs(days) returns logs within date range. createEmptyLog() factory with defaults (all 5s, no flare, empty foods/notes).

`src/stores/chatStore.ts` — ChatMessage storage. addMessage persists to IndexedDB. getMessagesForMilestone filters by milestoneContext. clearHistory wipes all chat messages.

`src/stores/settingsStore.ts` — Persisted via zustand/persist to localStorage key 'cyto-settings'. Stores: theme (light|dark), protocolStartDate (default '2026-02-13'), healthContext (nullable, falls back to defaultHealthContext).

`src/stores/uiStore.ts` — Transient UI state. selectedMilestoneId, isChatOpen, isLogOpen, isAnalyticsOpen, isSettingsOpen. Toggle and close methods for each. closeAllOverlays resets everything.

### 1.7 State Sync (Agent Integration Point)

File: `src/utils/stateSync.ts`

syncStateToServer() — Debounced (2000ms). POSTs a JSON snapshot to /api/state containing:
- updatedAt (ISO string)
- currentPhase (phase ID)
- overallProgress ({completed, total, percentage})
- milestones (array of {id, title, phaseId, status, progress})
- recentLogs (last 7 daily logs, stripped to core fields)

Called after: toggleActionItem, setFoodTrialOutcome, addMilestoneNote, deleteMilestoneNote, saveLog, deleteLog.

Silent failure — catches errors without alerting user (server may not be running in dev).

This is the web app's half of the agent integration. The external Telegram agent reads this state via GET /api/state to know current progress, and the web app pushes updates via this POST whenever anything changes. See section 3 for full integration spec.

### 1.8 App Shell

File: `src/App.tsx`

Entry point component. Initializes all stores (roadmapStore, dailyLogStore, chatStore) on mount via Promise.all. Shows loading state until all stores initialized.

Layout: BubbleMap always rendered. TypewriterTerminal shown when no overlays open. Floating buttons grouped by position (bottom-right: recenter/log/chat; bottom-left: analytics; top-right: settings). All buttons hidden when any panel is open.

Overlays are lazy-loaded via React.lazy: MilestoneDetail, DailyLogPanel, AnalyticsDashboard, ChatPanel, SettingsPanel. Each wrapped in AnimatePresence for enter/exit animations.

Recenter button toggles between focus (zoom to current milestone) and fit-all (show entire map).

Custom events: cyto-recenter (triggers recenter), cyto-recenter-mode (updates button icon).

### 1.9 BubbleMap (Main Visualization)

File: `src/components/BubbleMap/BubbleMap.tsx`

Container: Full-screen div with overflow hidden, touch-action: none. Manages transform state (x, y, scale).

Layers (bottom to top):
1. BackgroundParticles (canvas, z-index 0)
2. GooCanvas (canvas with SVG goo filter applied, z-index 1, opacity 0.32)
3. SVG overlay (labels and click targets, z-index 2, pointer-events none except on bubble g elements)

Hidden SVG defines the goo filter: feGaussianBlur (stdDeviation dynamically scaled with zoom via ref) -> feColorMatrix (values "1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -8") -> feBlend.

Pan/zoom: Native mouse handlers (mousedown/move/up on container/window, wheel with preventDefault). Native touch handlers (single finger pan, pinch-to-zoom). Tap detection: tracks touch start position and time, fires milestone selection if distance < 10px and time < 300ms.

Auto-zoom: On initial layout settle, zooms to current milestone at scale 1.2.

File: `src/components/BubbleMap/useBubbleLayout.ts`

Deterministic layout. Each milestone has a hardcoded { order, branch } config:
- order: 0 through 6 (horizontal position, 0.5 increments for branches)
- branch: main (center), upper (offset up), lower (offset down)

Spacing: 280px between positions. Y: sine wave (amplitude = min(8% viewport height, 60px)) + branch offset (min(12% viewport height, 90px)). Radius: max(45, min(80, 30 + actionItemCount * 4)).

Links generated from milestoneDependencies graph. Returns {bubbles, links, settled}. settled goes true after 800ms delay (once, for initial entrance animations).

File: `src/components/BubbleMap/GooCanvas.tsx` (364 lines)

Canvas animation loop. Draws:
1. Connections as thick tapered filled paths between milestone positions. Each connection sampled along its length, computing upper/lower outlines based on local normals. Width tapers: thick at endpoints (45% of smaller radius), thinner in middle (14% of smaller radius). Subtle sine-wave flow animation. Fan-out reduction where branches split (60% thickness if >2 connections share an endpoint). Gradient fill from source to target phase color.
2. Milestone blobs with organic sinusoidal radius deformation (multi-frequency rotation).
3. Nucleus shapes inside each blob (68% of blob radius, multi-harmonic deformation with 5 frequencies, 55% alpha).

Performance: Frame rate limited to 24fps on mobile, 45fps on desktop. Samples per 100px: 4 (mobile) vs 8 (desktop). DPR capped at 2.

Precomputes ConnectionData and BlobData on layout change (stable random offsets per connection/blob).

File: `src/components/BubbleMap/Bubble.tsx`

SVG overlay per milestone. Renders: transparent hit circle (for click), phase name label (Space Grotesk 11px), phase number (JetBrains Mono 8px, P0/P1/etc). Click triggers onTap callback.

File: `src/components/BubbleMap/BackgroundParticles.tsx`

Canvas layer. 40 particles on mobile, 70 on desktop. Each particle: drifting ellipse with wobble animation. Very low opacity (0.03-0.07). 4 faint membrane rings (petri dish culture rings) — ellipses centered on screen, slowly rotating and pulsing.

Respects prefers-reduced-motion (renders once, no animation loop).

### 1.10 Milestone Detail View

File: `src/components/MilestoneDetail/MilestoneDetail.tsx`

Full-screen overlay on mobile, centered 70-80% viewport on desktop. Backdrop with 70% opacity. Spring animation on entry (opacity + y translate). Contains: MilestoneHeader, QuickStats, Checklist, NotesLog. Close button with hover rotate animation.

File: `src/components/MilestoneDetail/MilestoneHeader.tsx` — Shows milestone title, phase name, phase color badge, description.

File: `src/components/MilestoneDetail/QuickStats.tsx` (214 lines) — Displays progress bar, completion count, phase progress, overall progress. Timeline intelligence: calculates expected dates using dependencyGraph utility, shows delay/ahead status, overdue count. Expandable action item list with category badges and completion toggles.

File: `src/components/MilestoneDetail/Checklist.tsx` (148 lines) — Grouped by category. Each item toggleable. Food trial items show pass/fail buttons. Category headers with counts.

File: `src/components/MilestoneDetail/NotesLog.tsx` (104 lines) — Add/delete milestone notes. Text input with timestamp display.

File: `src/components/MilestoneDetail/SubDetailView.tsx` — Reusable sub-overlay component with back button, title, phase color border. Used as container for drilldown views within MilestoneDetail.

### 1.11 Daily Log Panel

File: `src/components/DailyLog/DailyLogPanel.tsx` (163 lines)

Bottom-right overlay panel (full-width mobile, 384px desktop). Contains:
- DateSelector: navigate between dates
- LogSlider x4: Energy (coral), Brain Fog (purple), Mood (pink), Sleep Quality (blue)
- FlareToggle: boolean toggle, severity 1-5, trigger text input
- Weight: numeric input (lbs)
- FoodInput: food list management
- Notes: textarea

Auto-saves on every change (no submit button). Updates dailyLogStore which triggers syncStateToServer.

Supporting files:
- `src/components/DailyLog/DateSelector.tsx` — Date picker
- `src/components/DailyLog/LogSlider.tsx` — Styled range slider
- `src/components/DailyLog/FlareToggle.tsx` — Flare status with severity/trigger
- `src/components/DailyLog/FoodInput.tsx` — Food list input

### 1.12 Analytics Dashboard

File: `src/components/Analytics/AnalyticsDashboard.tsx`

Full-screen overlay. Grid layout (1 col mobile, 2 col desktop). Contains 6 chart cards:
- TrendChart (full width) — `src/components/Analytics/TrendChart.tsx` (122 lines). Uses Recharts LineChart. Displays energy, fog, mood, sleep trends over time from daily logs.
- WeightChart — `src/components/Analytics/WeightChart.tsx`. Weight tracking over time.
- FoodToleranceChart — `src/components/Analytics/FoodToleranceChart.tsx` (108 lines). Visualizes food frequency and flare correlation.
- FlareCalendar — `src/components/Analytics/FlareCalendar.tsx` (116 lines). Calendar heatmap of flare events.
- MilestoneProgress — `src/components/Analytics/MilestoneProgress.tsx`. Per-milestone completion bars.
- SupplementTracker (full width) — `src/components/Analytics/SupplementTracker.tsx`. Supplement compliance tracking.

All charts read from dailyLogStore and roadmapStore.

### 1.13 Chat Panel

File: `src/components/Chat/ChatPanel.tsx` (222 lines)

In-app chat interface. Attempts to send messages via anthropic.ts sendMessage(), which immediately throws an error: "Chat is handled via the OpenClaw agent. Direct API calls are not supported in the web app."

This means the in-app chat is effectively non-functional by design. The UI exists but messages will always error. Chat interaction is intended to happen via the external Telegram agent instead.

The chat panel does include infrastructure for:
- Message history persistence (IndexedDB via chatStore)
- Milestone context awareness (filters messages by active milestone)
- Action parsing (parses JSON action blocks from assistant responses via actionParser.ts)
- Action cards (Apply/Dismiss UI for parsed roadmap actions)
- System prompt building (cytoPrompt.ts builds context-rich prompts with health data, roadmap state, recent logs)

Supporting files:
- `src/components/Chat/MessageBubble.tsx` — Styled message display
- `src/components/Chat/TypingIndicator.tsx` — Loading dots
- `src/components/Chat/ActionCard.tsx` — Actionable suggestion cards

File: `src/utils/actionParser.ts` — Parses JSON action blocks from text. Supports fenced and inline JSON. Returns cleanText (with actions stripped) and actions array.

File: `src/utils/cytoPrompt.ts` — Builds comprehensive system prompt including health context, roadmap summary, recent logs, milestone-specific context. Defines the cyto personality inline.

File: `src/lib/anthropic.ts` — Stub. sendMessage() throws immediately. Types exported for interface compatibility.

### 1.14 Settings Panel

File: `src/components/Settings/SettingsPanel.tsx` (286 lines)

Features:
- Theme toggle (light/dark) with animated switch
- Protocol start date input (date picker, stored in settingsStore)
- Health context editor (editable textarea, defaults to healthContext.ts content, reset to default option)
- Data export (downloads all IndexedDB tables + settings as JSON)
- Data import (reads JSON file, bulk-puts into IndexedDB, reinitializes stores)
- Reset all data (clears all IndexedDB tables, removes localStorage, reloads page)

File: `src/data/healthContext.ts` — Default health context string with medical data. Injected into chat system prompt. Editable via settings.

### 1.15 UI Components

File: `src/components/UI/FloatingButton.tsx` — Reusable button with organic cell aesthetic: membrane layer (phase color at 30% opacity, membrane-breathe animation), nucleus layer (55% opacity), border ring (25% opacity). Spring scale animations on hover/tap. Supports fixed positioning or inline.

File: `src/components/UI/TypewriterTerminal.tsx` — Top-left terminal-style display. Cycles through hardcoded messages ("initializing recovery protocol...", "mapping gut microbiome state...", etc.) with typewriter effect. JetBrains Mono 11px, 55% opacity. Cursor blink at 530ms.

File: `src/components/UI/ThemeProvider.tsx` — Adds/removes 'dark' class on document root. Updates meta theme-color for mobile browsers.

### 1.16 Theme System

File: `src/styles/theme.ts`

Phase colors: 8 phases x 2 modes (light and dark). Light uses warm muted pastels; dark uses deeper saturated variants.

Theme colors: light (cream bg #FFF8F7, charcoal text, gold accent, muted green done) / dark (navy bg #0F0E17, white text, copper accent, teal done).

Phase names: Immediate, Assess + Decide, Eradication, Restoration, Food Reintroduction, Retest + Reassess, Optimization, Maintenance.

Helper functions: getPhaseColor(index, isDark), getPhaseColorOpacity(index, isDark, status).

File: `tailwind.config.ts` — Extends with phase/phase-dark color tokens, cream/navy/charcoal/softwhite/gold/copper/done-light/done-dark colors. Custom blob borderRadius. Font families: Inter (body), Space Grotesk (display), JetBrains Mono (mono).

NOTE: tailwind.config.ts defines different phase color values than theme.ts. Tailwind phase colors are warmer/earthier; theme.ts phase colors are more pastel/varied. [POTENTIAL INCONSISTENCY — unclear which is authoritative]

File: `src/styles/globals.css` — Animated background gradients (light: warm cream radials, dark: deep earthy radials, both with 45s gradient-shift animation). Blob shapes (border-radius presets). Membrane-breathe keyframe (8s ease-in-out, morphs border-radius through 3 states). Pulse-glow keyframe (3s). Scrollbar styling. tap-highlight-color: transparent. body: overflow hidden, overscroll-behavior: none.

### 1.17 Timeline Intelligence

File: `src/utils/dependencyGraph.ts` (102 lines)

calculateTimelineDates() — Walks the dependency graph forward from protocolStartDate. For each milestone, checks if blocking dependencies are complete and adjusts expected start/end dates based on actual completion times. Returns CalculatedDates[] with expectedStart, expectedEnd, delayDays (positive = delayed, negative = ahead).

getMilestoneGlowState(milestoneId) — Returns 'none' | 'orange' (1-7 days delayed) | 'red' (>7 days delayed). Used for visual urgency indicators.

File: `src/utils/dateCalc.ts` — Utility functions: addDays, diffDays, today, isOverdue, daysSinceOverdue.

### 1.18 Mobile Handling

- viewport meta: maximum-scale=1.0, user-scalable=no
- touch-action: none on BubbleMap container
- Native touch event listeners (not React synthetic events, not Framer Motion drag)
- Single-finger pan, two-finger pinch zoom
- Tap detection with distance/time thresholds
- Frame rate limiting: 24fps on mobile vs 45fps desktop
- Reduced particle count: 40 vs 70
- Reduced sample density: 4 vs 8 samples per 100px on connections
- DPR capped at 2
- prefers-reduced-motion support (BackgroundParticles renders once, skips animation loop)
- Responsive overlay sizing: full-screen mobile, windowed desktop

---

## 2. Planned Features (Discussed But Not Yet Built)

### 2.1 Server / Backend

CLAUDE.md references `server/index.ts` as a "Hono server" serving static build + /api/state endpoint. package.json has scripts referencing `cd server && npm run start`. vite.config.ts proxies /api to localhost:3000.

[REFERENCED BUT NOT FOUND IN UPLOADED SOURCE — the server/ directory was not included. It may exist in the repo but was not uploaded.]

The /api/state endpoint (GET/POST) is the primary integration point with the agent. stateSync.ts already POSTs to /api/state on every state change. The server needs to exist for this to function.

### 2.2 Agent REST API Endpoints

An external Telegram AI agent (OpenClaw) needs to read and write data from this web app. The web app server must expose these endpoints:

Read (agent pulls state):
- GET /api/state — Full roadmap state snapshot (current phase, milestone progress, recent logs, overdue items, completion percentages, timeline data). This is the primary endpoint. The agent's health-check skill curls this to build context-aware responses and cron job messages.

Write (agent pushes changes):
- POST /api/log — Write a daily log entry received via Telegram
- POST /api/action — Mark an action item complete, update dates, add notes
- POST /api/food-trigger — Update food trigger/tolerance data from food trial reports
- POST /api/supplements — Update supplement stack changes

The stateSync.ts client code already pushes state via POST /api/state on every web app state change. The other write endpoints (log, action, food-trigger, supplements) would allow the agent to write BACK to the web app when the user reports things via Telegram instead of the web UI.

Authentication: [UNCONFIRMED — no auth discussed for the REST API. Currently no auth layer planned. The agent runs on a VPS and would curl these endpoints directly.]

### 2.3 Railway Deployment

CLAUDE.md mentions "Hono on Railway" as the server platform. No Railway config files found in source. Deployment is pending — the agent has placeholder URLs waiting for the deployed URL.

### 2.4 Visual Overhaul (Queued Prompt Sequence)

From docs/VISUAL_OVERHAUL_PROMPTS.md (installed in repo). Contains 3 pre-written prompts for visual improvements. Per CLAUDE.md: "DO NOT run unless Willem says to."

Prompt 1: Revert broken visuals + fix core bugs
Prompt 2: [Check repo docs/ folder for content]
Prompt 3: [Check repo docs/ folder for content]

### 2.5 Future Ideas (v2+)

From docs/WEB_APP_FUTURE_IDEAS.md (installed in repo):
1. Agar.io Progression — Active orb moves toward next as tasks complete, leaves slime trail, merges at 100%
2. Pulse Ring — Heartbeat ring expanding from active milestone
3. Progress Fill — Nucleus fills like a beaker based on % completion
4. Cell Division — Mitosis animation on phase completion
5. Spore Trail — Static dots tracing completed path
6. Nucleus Dot — Darker organelle drifting toward next phase
7. Sound Design — Wet membrane sounds on interactions
8. Locked Phase Visuals — Spore/seed state + frosted overlay
9. Background Organisms — Large blurry depth-of-field blobs in distance
10. Typography — JetBrains Mono for specimen labels with bracket underlines
11. Organelle Icons — Nucleus=Chat, Ribosome=Log, Mitochondria=Analytics

---

## 3. Known Issues and Technical Debt

From docs/WEB_APP_KNOWN_BUGS.md (installed in repo):
1. Settings button invisible — Low contrast or z-index conflict in top-right
2. Analytics button cut off — bottom-6 vs mobile safe areas
3. Goo connections look like "umbilical cords" — curveBow too high in GooCanvas
4. Bridge dots visible as individual circles when zoomed — Addressed in current code (filled paths instead of dots)
5. Tap-then-close bug — Tapping milestone then closing detail breaks all interaction (likely AnimatePresence exit blocking pointer events or touch handler state not resetting)
6. Mobile zoom/pan performance — Mitigated by removing feTurbulence and using Canvas, may need further optimization

From code inspection:
- Chat panel is non-functional (anthropic.ts throws immediately). The UI exists but cannot complete a message exchange.
- Phase colors have dual definitions (tailwind.config.ts vs theme.ts) with different values. Could cause visual inconsistency.
- D3 is listed as a dependency but not used for layout or rendering. Dead dependency weight.
- milestoneGlowState (orange/red delay indicators) is computed but not visually rendered anywhere in the current BubbleMap or Bubble components.

---

## 4. Architecture Decisions (Already Made — Do Not Revisit)

From CLAUDE.md and docs/WEB_APP_APPROACHES_TRIED.md:

Canvas for goo, SVG for UI: Canvas handles goo rendering with blur filters efficiently. SVG keeps labels/buttons crisp. These are separate layers with different z-indices.

CSS keyframes for ambient animation: Membrane breathing is pure CSS (GPU accelerated). No JS animation loops for constant ambient effects.

Deterministic layout: Milestone positions are pre-calculated from a hardcoded config map, NOT D3 force simulation. Same positions every load.

Native touch handlers: Framer Motion drag conflicted with pan/zoom. Using native addEventListener with passive: false on plain elements.

No scale animations on overlays: Scale transforms on SubDetailView/MilestoneDetail cause text jitter. Only opacity, y translate, border-radius, and box-shadow animate.

Failed approaches (do NOT retry):
- Hiroyuki Sato metaball algorithm (SVG paths) — Static geometric shapes, spider webs, maxDist logic prevented rendering at 280px spacing
- SVG filter gooey effect on groups — Orange borders from contrast matrix, discrete dots, low-opacity elements vanish
- feTurbulence for cell shapes — 15fps on mobile
- Catmull-Rom blob generation — Hexagons or pie pieces
- Framer Motion drag for map navigation — Conflicted with layout/click events
- Custom handlers + motion.g — Framer interpolates even with duration: 0

---

## 5. Agent Integration Spec (What the Web App Must Provide)

The external agent is an OpenClaw instance on a Hostinger VPS communicating via Telegram. It is NOT part of this codebase. But this web app must serve it data.

### 5.1 Current State

NOT connected. Web app not deployed. Agent has placeholder URLs.

The web app already has:
- stateSync.ts — debounce-POSTs state snapshots to /api/state on every mutation (client-side, fires silently even though server doesn't exist yet)

The web app does NOT have:
- A running server to receive those POSTs
- Any GET endpoint for the agent to read state
- Any write endpoints for the agent to push data back

### 5.2 Required Endpoints (For Agent Connection)

The server (Hono on Railway) must implement:

GET /api/state — Returns JSON:
```json
{
  "updatedAt": "ISO string",
  "currentPhase": "phase-id",
  "overallProgress": { "completed": 12, "total": 78, "percentage": 15.4 },
  "milestones": [{ "id": "ms-...", "title": "...", "phaseId": "...", "status": "in_progress", "progress": { "completed": 3, "total": 8 } }],
  "recentLogs": [{ "date": "2026-02-18", "energy": 5, "fog": 6, "mood": 5, "sleep": 7, "flare": false, "weight": 145 }]
}
```
This is what stateSync.ts already builds and POSTs. The server stores the latest snapshot and serves it on GET.

POST /api/state — Accepts the above JSON from stateSync.ts. Stores it.

POST /api/log — Accepts a DailyLog object from the agent. Stores it so the web app can read it.

POST /api/action — Accepts { actionItemId, completed, completedDate?, foodTrialOutcome? }. Updates the action item state.

POST /api/food-trigger — Accepts food trigger updates.

POST /api/supplements — Accepts supplement stack updates.

### 5.3 Data Flow

Source of truth: Web app (IndexedDB for client state, server for API layer).

Daily logs: User enters via DailyLogPanel (web app) OR via Telegram (agent). Web app logs go to IndexedDB + stateSync POST. Telegram logs POST to /api/log once endpoints exist.

Roadmap state: Managed in web app (roadmapStore + IndexedDB). Agent reads via GET /api/state. Agent writes changes via POST /api/action.

Milestones: Static data in roadmap.ts. Completion state in IndexedDB (actionItemStates table). Agent reads completion status via API. Agent marks items complete via POST /api/action.

Until deployment: Agent operates from its own memory files as the health data source. No live data sync.
