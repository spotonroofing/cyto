# Feature Architecture Breakdown

Comprehensive reference for planning new features. Covers data models, rendering pipeline, UI structure, and state management.

---

## 1. Milestones

### Data Structure

**Types** (`src/types/index.ts`):

```typescript
interface Milestone {
  id: string
  phaseId: string
  title: string
  description: string
  actionItemIds: string[]
  expectedStartDate?: string   // calculated from protocol start + phase offset
  expectedEndDate?: string     // calculated from start + duration
}

interface Phase {
  id: string
  name: string
  color: string                // e.g. '#FFB5A7'
  darkColor: string            // e.g. '#E07A6B'
  defaultStartOffset: number   // days after protocol start
  defaultDuration: number      // days
}

type MilestoneStatus = 'not_started' | 'in_progress' | 'completed' | 'overdue' | 'blocked'
```

### Where Stored

All milestone and phase definitions are **hardcoded** in `src/data/roadmap.ts`. There are **8 milestones**, one per phase. No API or database defines them — only user completion state is persisted.

| ID | Phase | Title | Action Items |
|---|---|---|---|
| `ms-diagnostic-baseline` | phase-0 (Immediate) | Diagnostic Baseline | 8 |
| `ms-interpret-results` | phase-1 (Assess + Decide) | Interpret Results | 6 |
| `ms-antibiotic-protocol` | phase-2 (Eradication) | Antibiotic Protocol | 9 |
| `ms-rebuild-gut` | phase-3 (Restoration) | Rebuild Gut | 7 |
| `ms-diet-expansion` | phase-4 (Food Reintroduction) | Systematic Diet Expansion | 30+ |
| `ms-confirm-progress` | phase-5 (Retest + Reassess) | Confirm Progress | 7 |
| `ms-expand-strengthen` | phase-6 (Optimization) | Expand + Strengthen | 5 |
| `ms-sustained-recovery` | phase-7 (Maintenance) | Sustained Recovery | 10 |

### Phase Timing

| Phase | Color | Duration | Start Offset (days) |
|---|---|---|---|
| phase-0 | #FFB5A7 | 7d | 0 |
| phase-1 | #FCD5CE | 8d | 7 |
| phase-2 | #D8BBFF | 14d | 15 |
| phase-3 | #B8F3D4 | 21d | 29 |
| phase-4 | #FFF3B0 | 42d | 50 |
| phase-5 | #A2D2FF | 14d | 78 |
| phase-6 | #FFAFCC | 90d | 92 |
| phase-7 | #C7DFC5 | 180d | 182 |

### Dependency Graph

Defined in `src/data/dependencies.ts`. Forms a DAG with one fork and one merge:

```
ms-diagnostic-baseline
        |
ms-interpret-results
        |
ms-antibiotic-protocol
       / \
      /   \
ms-rebuild-gut    ms-confirm-progress     (fork — parallel paths)
      |                   |
ms-diet-expansion         |
      \                  /
       \                /
ms-expand-strengthen                      (merge)
        |
ms-sustained-recovery
```

Phase-level dependencies mirror this: phase-5 depends on phase-2 (not phase-3/4), phase-6 depends on both phase-4 and phase-5.

### Home Screen Rendering

The vertical cell map uses a **hybrid Canvas + SVG** approach.

**Layout** (`src/components/BubbleMap/useBubbleLayout.ts`):
- Deterministic — same positions every load, no force simulation
- Row-based vertical layout with sine-wave horizontal offset for organic feel
- Constants: `ROW_SPACING = 280px`, `waveAmplitude = 40px`, `branchOffset = 160px`
- Fork at row 3 (`ms-rebuild-gut` left, `ms-confirm-progress` right), merge at row 5

```typescript
const milestoneLayout: Record<string, { row: number; branch: 'main' | 'left' | 'right' }> = {
  'ms-diagnostic-baseline': { row: 0, branch: 'main' },
  'ms-interpret-results':   { row: 1, branch: 'main' },
  'ms-antibiotic-protocol': { row: 2, branch: 'main' },
  'ms-rebuild-gut':         { row: 3, branch: 'left' },
  'ms-confirm-progress':    { row: 3.5, branch: 'right' },
  'ms-diet-expansion':      { row: 4, branch: 'left' },
  'ms-expand-strengthen':   { row: 5, branch: 'main' },
  'ms-sustained-recovery':  { row: 6, branch: 'main' },
}
```

Bubble radius scales with action item count: `radius = max(62, min(110, 41 + itemCount * 6))`.

**Rendering layers** (bottom to top):
1. `BackgroundParticles` (Canvas 2D) — ambient floating ellipses
2. `DotGrid` (Canvas 2D) — background grid
3. `GooCanvas` (WebGL2) — SDF goo membranes + nuclei + connections
4. SVG overlay — phase icons (Lucide), labels, hit targets

### Tap Interaction

In `BubbleMap.tsx`, native touch/mouse handlers distinguish taps from pans using thresholds (10px distance, 300ms time). On tap:

1. Screen coords converted to world coords via inverse transform
2. Distance checked against all bubble centers
3. If within radius: `uiStore.selectMilestone(milestoneId)` called
4. Sets `selectedMilestoneId` and `currentView = 'milestone'`
5. MilestoneDetail overlay mounts with spring animation

### Milestone Detail View

**File:** `src/components/MilestoneDetail/MilestoneDetail.tsx`

Opens as a full-screen overlay (mobile) or centered 70-80% viewport panel (desktop). Spring animation: `y: 40 → 0`, stiffness 150, damping 20.

```
MilestoneDetail
├── Backdrop (click to close)
├── Close Button (X)
├── MilestoneHeader
│   ├── Phase color pill + name + number
│   ├── Milestone title & description
│   ├── Calculated date range (from protocol start + offset)
│   ├── Delay badge (+Nd delayed / Nd ahead)
│   └── Progress circle (animated SVG arc) + "{completed}/{total} items"
│
├── QuickStats (phase-specific metric cards)
│   ├── All phases: Completion count
│   ├── Phase 2: Medications tracked
│   ├── Phase 4: Foods tried / Passed / Failed
│   └── Phase 5: Tests completed
│
├── Checklist (toggleable action items)
│   ├── Sorted: uncompleted first, then completed
│   ├── Checkbox (circle, phase-colored)
│   ├── Category badge (uppercase pill)
│   ├── Completion date stamp
│   └── Food trial: Pass/Fail outcome buttons (Phase 4 only)
│
└── NotesLog
    ├── Textarea + Add button (Enter to submit)
    ├── Timestamped note list (reverse chronological)
    └── Delete button (hover-reveal per note)
```

**SubDetailView** (`src/components/MilestoneDetail/SubDetailView.tsx`): A nested overlay (z-50 above detail's z-40) for expanded stat breakdowns. Tapping a QuickStats card opens it. Shows detailed item lists grouped by status, tier, or category.

### Key Files

| File | Purpose |
|---|---|
| `src/types/index.ts` | Milestone, Phase, ActionItem, MilestoneStatus types |
| `src/data/roadmap.ts` | Hardcoded phases, milestones, action items |
| `src/data/dependencies.ts` | Milestone + phase dependency DAG |
| `src/stores/roadmapStore.ts` | Completion state, progress getters, note CRUD |
| `src/components/BubbleMap/useBubbleLayout.ts` | Deterministic layout positions |
| `src/components/BubbleMap/BubbleMap.tsx` | Map container, pan/zoom, tap detection |
| `src/components/BubbleMap/Bubble.tsx` | SVG icons, labels, hit targets |
| `src/components/MilestoneDetail/MilestoneDetail.tsx` | Detail overlay container |
| `src/components/MilestoneDetail/MilestoneHeader.tsx` | Title, progress circle, dates |
| `src/components/MilestoneDetail/Checklist.tsx` | Action item list + toggle UI |
| `src/components/MilestoneDetail/QuickStats.tsx` | Phase-specific metric cards |
| `src/components/MilestoneDetail/SubDetailView.tsx` | Nested detail overlay |
| `src/components/MilestoneDetail/NotesLog.tsx` | Notes CRUD UI |

---

## 2. Action Items / Tasks

### Data Model

```typescript
interface ActionItem {
  id: string
  phaseId: string
  milestoneId: string
  title: string
  description?: string
  completed: boolean
  completedDate?: string          // ISO date
  dueDate?: string                // ISO date (calculated)
  blocksDownstream: boolean
  dependsOn: string[]             // IDs of prerequisite items
  category: 'test' | 'medication' | 'supplement' | 'diet' | 'lifestyle' | 'peptide' | 'consultation'
  foodTrial?: {
    food: string
    tier: number                  // 1-4
    outcome?: 'pass' | 'fail'
  }
}
```

### Categories

Seven categories, displayed as uppercase pill badges in the checklist:

| Category | Usage |
|---|---|
| `test` | Lab tests, diagnostics (bloodwork, CGM, H. pylori) |
| `medication` | Prescriptions & OTC (cetirizine, famotidine, antibiotics, PPIs) |
| `supplement` | Nutritional supplements (probiotics, butyrate, SBI, minerals) |
| `diet` | Food trials and reintroduction (tiered system) |
| `lifestyle` | Behavioral tracking (daily logging, weight, activity, flares) |
| `peptide` | Peptide therapies (GHK-Cu, CJC/Ipamorelin, KPV, BPC-157) |
| `consultation` | Medical consultations and decision points |

### Completion State Tracking

**Defaults** live in `src/data/roadmap.ts` (all items start `completed: false`).

**User state** persists in IndexedDB via Dexie:

```typescript
// src/lib/db.ts
interface StoredActionItemState {
  id: string
  completed: boolean
  completedDate?: string
  notes?: string
  foodTrialOutcome?: 'pass' | 'fail'
}
```

Table: `actionItemStates` (primary key: `id`).

**Merge at runtime**: `roadmapStore.getActionItem(id)` merges the hardcoded default with stored state. The store keeps an in-memory `Map<string, StoredActionItemState>`.

### Toggle Flow

```
User taps checkbox in Checklist
  → ChecklistItem.onToggle()
  → roadmapStore.toggleActionItem(id)
  → Flip completed, set completedDate = today
  → db.actionItemStates.put(newState)        [IndexedDB write]
  → set({ actionItemStates: updatedMap })    [Zustand update]
  → syncStateToServer()                      [debounced 2s POST /api/state]
  → Component re-renders via getActionItem() merge
```

### Food Trial System (Phase 4)

Items with `foodTrial` defined get Pass/Fail buttons instead of a simple checkbox. Tiers:

- **Tier 1:** Base foods (eggs, salmon, avocado, chicken, beef, sweet potato, etc.)
- **Tier 2:** Intermediate (white potato, broccoli, cauliflower, spinach, banana, oats)
- **Tier 3:** Advanced (almonds, pumpkin seeds, chia seeds, ginger, green tea)
- **Tier 4:** Complex (legumes, sesame, rice, octopus)

`setFoodTrialOutcome(id, 'pass'|'fail')` marks the item completed and records the outcome.

### Progress Calculation

Three levels, all in `roadmapStore.ts`:

```typescript
getMilestoneProgress(milestoneId) → { completed, total, percentage }
// completed = items.filter(a => a.completed).length
// percentage = Math.round((completed / total) * 100)

getPhaseProgress(phaseId) → { completed, total, percentage }
// Same logic, filtered by phaseId

getOverallProgress() → { completed, total, percentage }
// Sum across ALL action items
```

### Milestone Status Derivation

```typescript
getMilestoneStatus(milestoneId) → MilestoneStatus
// 'completed' if all items done
// 'in_progress' if any item done
// 'blocked' if upstream dependencies incomplete
// 'not_started' otherwise
```

Dependencies checked via `items.flatMap(a => a.dependsOn)` — if any dependency item is not completed, the milestone is blocked.

### Checkbox UI

`src/components/MilestoneDetail/Checklist.tsx`:

- Circular checkbox button styled with phase color (filled when complete, hollow when pending)
- Checkmark SVG inside when completed
- Category badge: `<span>` with uppercase text, 10px font, phase-tinted background at 20% opacity
- Completion date stamp: mono font, 40% opacity
- Sorted: uncompleted items first
- Framer Motion stagger animation on list items

### Key Files

| File | Purpose |
|---|---|
| `src/types/index.ts` | ActionItem type definition |
| `src/data/roadmap.ts` | All default action items (hardcoded) |
| `src/lib/db.ts` | StoredActionItemState type, Dexie table |
| `src/stores/roadmapStore.ts` | Toggle, food trial, progress getters |
| `src/components/MilestoneDetail/Checklist.tsx` | Checkbox list UI |
| `src/components/MilestoneDetail/QuickStats.tsx` | Phase-specific stat cards |

---

## 3. Daily Logs

### Current State

Daily logging is **fully built** with a dedicated UI panel.

### Data Model

```typescript
// src/types/index.ts
interface DailyLog {
  date: string            // YYYY-MM-DD (primary key)
  energy: number          // 1-10 slider
  fog: number             // 1-10 slider (brain fog)
  mood: number            // 1-10 slider
  sleep: number           // 1-10 slider
  flare: boolean          // yes/no toggle
  flareSeverity?: number  // 1-5 if flare=true
  flareTrigger?: string   // optional text
  weight?: number         // lbs
  foods: string[]         // free-text food entries
  notes: string           // free-text
  timestamp: number       // ms when created/updated
}
```

### Storage

IndexedDB via Dexie (`cytoDB` database):
- Table: `dailyLogs`, primary key: `date`, indexed on `timestamp`
- State managed by `dailyLogStore` (Zustand)

### Daily Log UI

**Access**: Floating "+" button (bottom-right of map). Opens as a modal panel with spring animation.

**Components** (`src/components/DailyLog/`):

| Component | Purpose |
|---|---|
| `DailyLogPanel.tsx` | Main container, auto-save logic |
| `DateSelector.tsx` | Date picker (today or backfill past days) |
| `LogSlider.tsx` | Reusable 1-10 slider for energy/fog/mood/sleep |
| `FlareToggle.tsx` | Toggle + conditional severity/trigger inputs |
| `FoodInput.tsx` | Tag-based food entry (add/remove) |

**Behavior**:
- Auto-saves on every change (no submit button)
- Can view/edit any past date via date picker
- "Today" button returns to current date
- `createEmptyLog(date)` factory provides defaults

### Store

`src/stores/dailyLogStore.ts`:

```typescript
interface DailyLogState {
  logs: DailyLog[]
  initialized: boolean
}

// Actions:
initialize()                    // Load all logs from IndexedDB
saveLog(log: DailyLog)          // Upsert to IndexedDB + sync to server
getLogForDate(date: string)     // Retrieve by date
getRecentLogs(days: number)     // Last N days
deleteLog(date: string)         // Remove from IndexedDB
```

### Connection to Analytics

The analytics dashboard reads directly from `dailyLogStore`:
- `getRecentLogs(30)` for 30-day trend charts (energy, fog, mood, sleep)
- `getRecentLogs(90)` for weight chart
- All logs for flare calendar heatmap

### Is There a Dedicated Daily Log UI?

**Yes.** The `DailyLogPanel` is a standalone overlay accessible from the map FAB. It is separate from milestone action items. Milestone action items track *whether* tasks are done; the daily log captures *how you feel* each day.

### Server Sync

Last 7 days of logs are included in the `/api/state` POST payload (debounced 2s), providing the Telegram agent / external consumers with recent data.

### What's NOT Captured

- GI-specific symptom scores (only energy/fog/mood/sleep)
- Medication adherence (tracked via roadmap completion instead)
- Lab result values
- Stool quality metrics

### Key Files

| File | Purpose |
|---|---|
| `src/types/index.ts` | DailyLog type |
| `src/lib/db.ts` | Dexie table definition |
| `src/stores/dailyLogStore.ts` | CRUD store |
| `src/components/DailyLog/DailyLogPanel.tsx` | Main panel container |
| `src/components/DailyLog/DateSelector.tsx` | Date picker |
| `src/components/DailyLog/LogSlider.tsx` | 1-10 slider |
| `src/components/DailyLog/FlareToggle.tsx` | Flare toggle + severity |
| `src/components/DailyLog/FoodInput.tsx` | Food tag input |
| `src/utils/stateSync.ts` | Server sync (includes recent logs) |

---

## 4. Analytics

### What It Shows

The analytics dashboard has **6 chart components** in a responsive grid (two-column desktop, single-column mobile). The trend chart spans full width.

**Access**: Floating chart icon button (bottom-left of map).

### Charts

| Chart | File | Data Source | Displays |
|---|---|---|---|
| **TrendChart** | `TrendChart.tsx` | `dailyLogStore.getRecentLogs(30)` | 30-day line chart with toggle buttons for Energy / Fog / Mood / Sleep (1-10 scale) |
| **WeightChart** | `WeightChart.tsx` | `dailyLogStore.getRecentLogs(90)` | 90-day weight trend, filters out empty entries |
| **FoodToleranceChart** | `FoodToleranceChart.tsx` | `roadmapStore` (food trial items) | Cumulative % of foods tolerated, red dots for failures |
| **FlareCalendar** | `FlareCalendar.tsx` | `dailyLogStore` (all logs) | Monthly heatmap: orange (flare) / green (logged, no flare) / gray (no data). Tap for severity + trigger |
| **MilestoneProgress** | `MilestoneProgress.tsx` | `roadmapStore` (all milestones) | Overall % completion + per-phase progress bars |
| **SupplementTracker** | `SupplementTracker.tsx` | `roadmapStore` (category='supplement' items) | Active supplement count with completion tracking |

### Visualization Library

**Recharts** for line charts (TrendChart, WeightChart). Other charts use custom rendering.

### Data Sources Summary

- **From dailyLogStore**: energy, fog, mood, sleep, weight, flare events
- **From roadmapStore**: food trial outcomes, supplement completion, milestone progress

All computation is local — no server API calls for analytics.

### What's NOT Built

- AI-generated insights or recommendations
- Flare correlation analysis (auto-detecting triggers)
- Data export from analytics view (export exists in Settings)
- Historical comparison periods

### Key Files

| File | Purpose |
|---|---|
| `src/components/Analytics/AnalyticsDashboard.tsx` | Container, grid layout |
| `src/components/Analytics/TrendChart.tsx` | Multi-metric line chart |
| `src/components/Analytics/WeightChart.tsx` | Weight progression |
| `src/components/Analytics/FoodToleranceChart.tsx` | Food trial outcomes |
| `src/components/Analytics/FlareCalendar.tsx` | Monthly flare heatmap |
| `src/components/Analytics/MilestoneProgress.tsx` | Phase completion bars |
| `src/components/Analytics/SupplementTracker.tsx` | Supplement adherence |

---

## 5. Navigation & UI Structure

### App Architecture

**No router.** Single-page app with modal overlays managed by `uiStore`. The BubbleMap is always rendered; everything else layers on top via `AnimatePresence`.

```typescript
// src/stores/uiStore.ts
interface UIState {
  currentView: 'map' | 'milestone' | 'log' | 'analytics' | 'chat' | 'settings'
  selectedMilestoneId: string | null
  isChatOpen: boolean
  isLogOpen: boolean
  isAnalyticsOpen: boolean
  isSettingsOpen: boolean
}
```

### Component Hierarchy

```
App
├── BubbleMap (always rendered)
│   ├── BackgroundParticles (canvas)
│   ├── DotGrid (canvas)
│   ├── GooCanvas (WebGL2)
│   └── SVG overlay (Bubble components)
│
├── TypewriterTerminal (top-left, visible only on clean map)
│
├── FAB Buttons (AnimatePresence, hidden when overlays open)
│   ├── Bottom-right stack: Recenter, Daily Log (+), Chat
│   ├── Bottom-left: Analytics (chart icon)
│   └── Top-right: Settings (gear icon)
│
├── MilestoneDetail overlay (AnimatePresence)
│   └── SubDetailView nested overlay
│
├── DailyLogPanel overlay (AnimatePresence)
├── AnalyticsDashboard overlay (AnimatePresence)
├── ChatPanel overlay (AnimatePresence)
└── SettingsPanel overlay (AnimatePresence)
```

### Vertical Scroll with Momentum

`BubbleMap.tsx` implements a custom scroll physics engine:

- **Y-only scrolling** — X is always recomputed to center content horizontally
- **Momentum**: Release velocity computed from last 80ms of movement history. Friction coefficient 0.92
- **Boundary springs**: Progressive drag resistance when overshooting (tension 0.15)
- **Adaptive auto-zoom**: Scale adjusts based on row bands:
  - Single-column sections: max scale 1.2x
  - Fork/merge zones: zoom in to show parallel paths
  - 35% viewport height lookahead prevents zoom jitter at transitions
- **Input**: Native mouse/touch event listeners (not Framer Motion, for performance)
  - Mouse: left-click drag for Y pan, wheel for scrolling
  - Touch: single-finger pan, two-finger pinch zoom (0.25x–3x range)

### Initial Camera Animation

On mount: two-stage animation
1. Fit entire map in viewport (compute bounds)
2. Fly camera to current milestone (1.1s ease-out cubic)

### Recenter Button Behavior

Toggles between two modes via `cyto-recenter` custom event:
- **Focus mode**: Animates to current (first incomplete) milestone
- **Fit-all mode**: Zooms out to show entire map

### FAB Buttons

`src/components/UI/FloatingButton.tsx` — generic cellular-themed button:

| Button | Position | Phase Color | Action |
|---|---|---|---|
| Recenter | Bottom-right (top) | Phase 0 | Toggle focus/fit-all |
| Daily Log | Bottom-right (mid) | Phase 3 | Toggle DailyLogPanel |
| Chat | Bottom-right (bottom) | Phase 2 | Toggle ChatPanel |
| Analytics | Bottom-left | Phase 5 | Toggle AnalyticsDashboard |
| Settings | Top-right | Phase 2 | Toggle SettingsPanel |

**Visual design**: Two-layer membrane (outer 30% opacity) + nucleus (55% opacity, 15% inset) + border ring. Spring scale animation on hover (1.08x) and tap (0.92x). Optional `membrane-breathe` CSS animation.

**Visibility**: All buttons hide when any overlay is open (`anyBottomPanelOpen` computed from uiStore).

### Milestone Detail Open/Close

- **Open**: `selectMilestone(id)` sets state → `AnimatePresence` mounts `MilestoneDetail` → spring animation (y: 40→0)
- **Close**: Backdrop click or X button → `selectMilestone(null)` → exit animation (y: 0→40)
- Mobile: full-screen (`inset-0`). Desktop: centered panel with rounded corners + shadow

### Notes System

At the bottom of MilestoneDetail. `src/components/MilestoneDetail/NotesLog.tsx`:
- Textarea input, Enter to submit (Shift+Enter for newline)
- Notes displayed in reverse chronological order with timestamps
- Delete button appears on hover per note
- Persisted to IndexedDB `milestoneNotes` table
- Spring animations on add/remove

### Settings Panel

`src/components/Settings/SettingsPanel.tsx` (top-right on desktop, full-screen mobile):

| Feature | Control |
|---|---|
| Theme | Dark/light toggle |
| Color theme | Swatch grid (radio selection) |
| Protocol start date | Date input |
| Health context | Editable textarea |
| Data export | JSON download |
| Data import | File picker for JSON |
| Reset all | Confirmation dialog → clears all Dexie tables + localStorage |

### Chat Panel

`src/components/Chat/ChatPanel.tsx` (bottom-right on desktop, full-screen mobile):
- Message history (persisted to Dexie `chatMessages` table)
- Optional `milestoneContext` when opened from detail view
- AI responses via Anthropic API with system prompt including health context
- Action parsing: AI can propose structured actions (complete_item, add_note)
- Action cards with Apply/Dismiss buttons
- Typing indicator during AI response

### TypewriterTerminal

`src/components/UI/TypewriterTerminal.tsx` — fixed top-left, 55% opacity. Rotates through 7 motivational messages ("initializing recovery protocol...", "trust the process.", etc.). Visible only on clean map.

### Key Files

| File | Purpose |
|---|---|
| `src/App.tsx` | Root component, store init, overlay orchestration |
| `src/stores/uiStore.ts` | UI visibility state |
| `src/components/BubbleMap/BubbleMap.tsx` | Pan/zoom/scroll physics, tap detection |
| `src/components/UI/FloatingButton.tsx` | Generic FAB component |
| `src/components/UI/TypewriterTerminal.tsx` | Terminal text animation |
| `src/components/MilestoneDetail/MilestoneDetail.tsx` | Detail overlay |
| `src/components/MilestoneDetail/NotesLog.tsx` | Notes CRUD UI |
| `src/components/Settings/SettingsPanel.tsx` | Settings panel |
| `src/components/Chat/ChatPanel.tsx` | Chat interface |
| `src/components/DailyLog/DailyLogPanel.tsx` | Daily log panel |
| `src/components/Analytics/AnalyticsDashboard.tsx` | Analytics container |

---

## 6. Goo / Visual Layer

### Current Renderer

**WebGL2 SDF (Signed Distance Field)** shader — not Canvas 2D. Single fullscreen triangle, one draw call per frame. Premultiplied alpha blending.

Shaders are **embedded as JavaScript template strings** in `GooCanvas.tsx` (constants `SDF_VERT` and `SDF_FRAG`, ~225 lines of GLSL 3.0 ES). No `.glsl`/`.frag`/`.vert` files on disk.

### WebGL Limits

- `MAX_CELLS`: 12
- `MAX_CONNS`: 16

### How Cells Render (Membrane Layer)

Each cell is a circular SDF with animated radius deformation:

```glsl
breathe = sin(u_time * breatheSpeed + phase + i * 0.5) * breatheAmp
deformA = sin(u_time * deformASpeed + ...) * deformAAmp
deformB = sin(u_time * deformBSpeed + ...) * deformBAmp
```

Three simultaneous sine waves create organic wobble. Defaults: `membraneBreatheSpeed: 2`, `membraneBreatheAmp: 2.4`.

### How Cells Connect (Goo Bridges)

**SDF capsule with tapered radius profile:**
- Parameterize along the segment between two cell centers
- Wider radius at endpoints (`filletWidthRatio: 1.50`) — creates organic fillets where connections meet cells
- Narrower in the middle (`tubeWidthRatio: 0.175`) — thin organic bridge
- Smoothstep interpolation between fillet and tube widths
- Merged with cell SDFs via `smin()` (smooth minimum) with merge radius `sminK` (default 45px)

**Color blending**: Distance-weighted Gaussian falloff along the connection — colors interpolate smoothly between the two endpoint cells.

### Nucleus Layer (Inner Cell Shapes)

Separate SDF layer rendered on top of membrane via alpha-over compositing:

```glsl
// Harmonic deformation (angle-dependent wobble)
offset = breathing + sin(2 * angle) * amp2 + sin(3 * angle) * amp3 + sin(5 * angle) * amp5
```

Each nucleus has independent 2/3/5-lobe harmonic deformation. Nuclei are **not** merged via `smin` — sharp boundaries. Opacity controlled by `u_nucleusOpacity` (default 0.55).

### Alpha Compositing

Two-layer composite in fragment shader:

```glsl
float outA = nucAlpha + memAlpha * (1.0 - nucAlpha);
vec3 outC = (nucColor * nucAlpha + memColor * memAlpha * (1.0 - nucAlpha)) / outA;
fragColor = vec4(outC * outA, outA);  // Premultiplied alpha
```

### Background Particles

`src/components/BubbleMap/BackgroundParticles.tsx` — Canvas 2D:

- 300 particles (tunable) with randomized ellipse shapes
- World-space drift with velocity ±0.15/frame
- Animated ellipse axes via sine wobble
- Wrap around map bounds
- Viewport culling with 20px margin
- Opacity 0.11–0.23, color from `palette.particle`
- Pauses on mobile after 2s idle
- Respects `prefers-reduced-motion` (static render once)

### Dot Grid

`src/components/BubbleMap/DotGrid.tsx` — Canvas 2D:
- Grid of circles (radius 1.5px)
- Spacing: 35px desktop, 50px mobile
- Single `beginPath()` + batch all visible dots + one `fill()`
- Viewport-culled via grid index calculation

### Layer Stack (z-index order)

| z-index | Layer | Technology |
|---|---|---|
| 0 | BackgroundParticles | Canvas 2D |
| 0 | DotGrid | Canvas 2D |
| 1 | GooCanvas (membrane + nucleus) | WebGL2 SDF |
| 2 | SVG overlay (icons, labels, hit targets) | SVG |

All layers share the same `transform: { x, y, scale }` from React state. Canvas layers cache transform in refs to avoid lag during panning.

### Performance Optimizations

**Device tiers** (`src/utils/performanceTier.ts`):

| Setting | Desktop | Mobile |
|---|---|---|
| Canvas DPR | 2 | 2 |
| Goo FPS | 60 | 60 |
| Particle count | 105 | 15 |
| Dot DPR | 2 | 1 |
| Dot spacing | 35px | 50px |

**Idle detection**:
- GooCanvas: Still renders at 60fps for breathing, but skips expensive recalc when idle
- BackgroundParticles: 2s idle → 500ms polling
- DotGrid: 100ms polling when transform unchanged

**Early termination**: Fragment shader performs bounding box culling before SDF evaluation — fragments outside all cell/connection bounds are discarded early.

### Adding New Visual Elements

**To add animated goo objects to the map:**

1. **Shader** (`GooCanvas.tsx`): Add new uniform array, compute SDF distance in fragment shader, merge with `smin()`, add to alpha-over composite. Each new SDF adds ~5-10 shader lines.
2. **JavaScript** (`GooCanvas.tsx`): Pack object data, create uniform array, upload via `gl.uniform4fv()` before draw call.
3. **SVG overlay** (`BubbleMap.tsx`): Add new SVG group with same `transform` prop for crisp text/UI on top.
4. **Performance budget**: Stay under 16ms/frame. SDF evaluation cost scales linearly with object count. Bounding box culling helps but adds per-object overhead.

**To add non-goo visual elements:**
- Canvas 2D layer: Add new component similar to `BackgroundParticles`, mount between DotGrid and GooCanvas
- SVG layer: Add to existing SVG overlay in BubbleMap — cheapest option for static/interactive UI elements
- HTML overlay: Layer a positioned div over the canvas stack for rich HTML content (tooltips, badges)

### Tuning System

`src/stores/tuningStore.ts` exposes 28+ visual parameters as uniforms:
- Bridge geometry: `tubeWidthRatio`, `filletWidthRatio`
- Nucleus: `nucleusRatioSvg`
- SDF merge: `sminK`, `sminKNucleus`
- All breathing/wobble speeds and amplitudes
- Particle count and spread
- Icon and font sizes

All values are passed as shader uniforms every frame, enabling real-time visual tuning.

### Key Files

| File | Purpose |
|---|---|
| `src/components/BubbleMap/GooCanvas.tsx` | WebGL2 SDF renderer + embedded GLSL shaders |
| `src/components/BubbleMap/BackgroundParticles.tsx` | Canvas 2D particle system |
| `src/components/BubbleMap/DotGrid.tsx` | Canvas 2D grid |
| `src/components/BubbleMap/BubbleMap.tsx` | Layer orchestration, SVG overlay |
| `src/components/BubbleMap/Bubble.tsx` | SVG per-milestone (icon, label, hit target) |
| `src/components/BubbleMap/gooMath.ts` | Color conversion helpers (hexToVec3) |
| `src/stores/tuningStore.ts` | Visual parameter store (28+ values) |
| `src/stores/debugStore.ts` | Runtime rendering toggles |
| `src/utils/performanceTier.ts` | Device-aware performance settings |
| `src/themes/palettes.ts` | Phase colors, goo/nucleus opacity, particle color |
| `src/styles/globals.css` | `membrane-breathe` CSS keyframes |

---

## 7. State Management

### Store Inventory

7 Zustand stores total:

| Store | File | Persistence | Purpose |
|---|---|---|---|
| **roadmapStore** | `src/stores/roadmapStore.ts` | Dexie (IndexedDB) | Action item completion, milestone notes, progress |
| **dailyLogStore** | `src/stores/dailyLogStore.ts` | Dexie (IndexedDB) | Daily symptom/food/flare logs |
| **chatStore** | `src/stores/chatStore.ts` | Dexie (IndexedDB) | Chat message history |
| **settingsStore** | `src/stores/settingsStore.ts` | localStorage | Theme, protocol date, health context |
| **uiStore** | `src/stores/uiStore.ts` | None (runtime) | Overlay visibility, selected milestone |
| **tuningStore** | `src/stores/tuningStore.ts` | None (runtime) | Visual parameter tweaking |
| **debugStore** | `src/stores/debugStore.ts` | None (runtime) | Rendering toggles and caps |

### IndexedDB Schema

Database name: `cytoDB` (Dexie).

```typescript
// src/lib/db.ts
db.version(1).stores({
  dailyLogs:        'date, timestamp',
  chatMessages:     'id, timestamp, milestoneContext',
  actionItemStates: 'id',
  milestoneNotes:   'id, milestoneId, timestamp',
})
```

| Table | Primary Key | Indices | Content |
|---|---|---|---|
| `dailyLogs` | `date` (YYYY-MM-DD) | timestamp | Daily health metrics |
| `chatMessages` | `id` | timestamp, milestoneContext | Chat history |
| `actionItemStates` | `id` | — | Completion state per action item |
| `milestoneNotes` | `id` | milestoneId, timestamp | User notes on milestones |

### Hardcoded vs Dynamic vs Persisted

| Data | Source | Mutability |
|---|---|---|
| Phases (8) | `src/data/roadmap.ts` | Read-only |
| Milestones (8) | `src/data/roadmap.ts` | Read-only |
| Action items (defaults) | `src/data/roadmap.ts` | Read-only |
| Phase/milestone dependencies | `src/data/dependencies.ts` | Read-only |
| Default health context | `src/data/healthContext.ts` | Read-only |
| Action item completion | IndexedDB `actionItemStates` | User-mutable |
| Food trial outcomes | IndexedDB `actionItemStates` | User-mutable |
| Milestone notes | IndexedDB `milestoneNotes` | User-mutable |
| Daily logs | IndexedDB `dailyLogs` | User-mutable |
| Chat messages | IndexedDB `chatMessages` | User-mutable |
| Theme, protocol date, health context | localStorage `cyto-settings` | User-mutable |
| Tuning parameters | In-memory only | Runtime-only (reset on reload) |
| Debug toggles | In-memory only | Runtime-only |
| UI state | In-memory only | Runtime-only |

### Initialization Order

In `App.tsx` useEffect on mount:

```typescript
Promise.all([
  useRoadmapStore.getState().initialize(),    // Load IndexedDB → Map
  useDailyLogStore.getState().initialize(),   // Load IndexedDB → array
  useChatStore.getState().initialize(),       // Load IndexedDB → array
]).then(() => setReady(true))

// settingsStore loads automatically via Zustand persist middleware
// tuningStore, uiStore, debugStore use defaults (no persistence)
```

UI renders only after `ready = true`.

### Server API

`server/index.ts` — Hono on Node.js, PostgreSQL backend.

**Client → Server sync** (`src/utils/stateSync.ts`):
- Debounced 2s POST to `/api/state` after any mutation
- Payload includes: overall progress, per-milestone status/progress, last 7 days of logs, current phase, timestamp
- Silent fail if server unreachable

**Server endpoints:**

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/state` | GET | Read current app state (consumed by Telegram agent / OpenClaw) |
| `/api/state` | POST | Write app state snapshot from client |
| `/api/health/import` | POST | Import Apple Health metrics (API key auth) |
| `/api/health/backfill` | POST | Reprocess raw metrics into structured tables |
| `/api/health/summary/today` | GET | Today's sleep/nutrition/weight |
| `/api/health/sleep/latest` | GET | Most recent sleep session |
| `/api/health/nutrition/today` | GET | Today's nutrition |
| `/api/health/sleep/range` | GET | Sleep data for date range |
| `/api/health/weight/range` | GET | Weight data for date range |
| `/api/health/nutrition/range` | GET | Nutrition data for date range |
| `/api/health/summary/:date` | GET | Summary for specific date |

**PostgreSQL tables** (server-side only, not accessed by client directly):

| Table | Content |
|---|---|
| `health_metrics` | Raw Apple Health data |
| `sleep_sessions` | Parsed sleep sessions |
| `nutrition_daily` | Aggregated daily nutrition (macros + micros as JSONB) |
| `weight_entries` | Body weight history |

### Cross-Store Communication

No direct store-to-store subscriptions. Each store manages its own domain. Components that need data from multiple stores call each store's hooks independently. State sync to server is the only cross-cutting concern, handled by `syncStateToServer()` which reads from both `roadmapStore` and `dailyLogStore`.

### Data Flow Diagram

```
┌─────────────────── CLIENT ───────────────────────────┐
│                                                       │
│  Hardcoded Data (read-only)                          │
│  ├── src/data/roadmap.ts (phases, milestones, items) │
│  ├── src/data/dependencies.ts (DAG)                  │
│  └── src/data/healthContext.ts (default context)     │
│                                                       │
│  localStorage                                         │
│  └── settingsStore ← theme, date, context            │
│                                                       │
│  IndexedDB (cytoDB)                                   │
│  ├── actionItemStates ← roadmapStore                 │
│  ├── milestoneNotes   ← roadmapStore                 │
│  ├── dailyLogs        ← dailyLogStore                │
│  └── chatMessages     ← chatStore                    │
│                                                       │
│  In-memory (runtime)                                  │
│  ├── uiStore (view state)                            │
│  ├── tuningStore (visual params)                     │
│  └── debugStore (render toggles)                     │
│                                                       │
│  On mutation → syncStateToServer() (debounced 2s)    │
│         POST /api/state ──────────────────────┐      │
└───────────────────────────────────────────────┼──────┘
                                                │
┌─────────────────── SERVER ────────────────────┼──────┐
│                                                │      │
│  /api/state  ← receives snapshot ─────────────┘      │
│  │  └── state.json (file cache, ephemeral)           │
│  │  └── In-memory currentState                       │
│  │                                                    │
│  PostgreSQL                                           │
│  ├── health_metrics  ← Apple Health import           │
│  ├── sleep_sessions  ← parsed                        │
│  ├── nutrition_daily ← aggregated                    │
│  └── weight_entries  ← weight history                │
│                                                       │
│  GET /api/state → Telegram agent / OpenClaw          │
└──────────────────────────────────────────────────────┘
```

### Key Files

| File | Purpose |
|---|---|
| `src/stores/roadmapStore.ts` | Core store: completion, notes, progress, status |
| `src/stores/dailyLogStore.ts` | Daily health log CRUD |
| `src/stores/chatStore.ts` | Chat message history |
| `src/stores/settingsStore.ts` | Theme + protocol settings (localStorage) |
| `src/stores/uiStore.ts` | Overlay/view visibility |
| `src/stores/tuningStore.ts` | Visual parameter tuning (28+ params) |
| `src/stores/debugStore.ts` | Render toggles + caps |
| `src/lib/db.ts` | Dexie database setup + stored types |
| `src/utils/stateSync.ts` | Client → server sync (debounced POST) |
| `src/data/roadmap.ts` | Hardcoded phases, milestones, action items |
| `src/data/dependencies.ts` | Dependency DAG |
| `src/data/healthContext.ts` | Default health context template |
| `server/index.ts` | Hono server, PostgreSQL, all API endpoints |
