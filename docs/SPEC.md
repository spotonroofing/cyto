\# Cyto — Full Specification



\## 1. OVERVIEW



\### 1.1 Purpose

\*\*Cyto\*\* (from "cytoplasm" — the living stuff inside cells) is a personal health recovery tracker that visualizes a multi-phase gut health protocol as an interactive, animated bubble map. Cyto serves as a visual command center for tracking progress, logging daily health data, viewing analytics, and communicating with an AI health coach. The name works as both the app brand and the AI coach character — Cyto is the living organism that wraps around your health journey.



\### 1.2 User

Single user (Willem, 22M). No authentication needed. App is personal-use only.



\### 1.3 Platforms

\- Primary: Mobile (iPhone Safari / Chrome)

\- Secondary: Desktop browser

\- Must be fully responsive — all interactions work on both



\### 1.4 Deployment

Static site on Railway (Vite build output)



---



\## 2. VISUAL DESIGN SYSTEM



\### 2.1 Design Philosophy

The visual language is organic, living, and breathing. Think: biological organisms, amoebas, cell division, membrane physics. Nothing should feel like a traditional dashboard. Elements float, pulse subtly, and transition fluidly. The app should feel like Cyto itself is alive — like looking into a petri dish of your own health journey, with Cyto as the organism guiding you through it.



\### 2.2 Color Palette — Pastel Rainbow



\*\*Light Mode:\*\*

\- Background: Warm cream (#FFF8F0) with subtle gradient shifts

\- Bubble colors (assigned by phase/category):

&nbsp; - Phase 0 (Immediate): Soft coral (#FFB5A7)

&nbsp; - Phase 1 (Assess): Pastel peach (#FCD5CE)

&nbsp; - Phase 2 (Eradication): Lavender (#D8BBFF)

&nbsp; - Phase 3 (Restoration): Soft mint (#B8F3D4)

&nbsp; - Phase 4 (Food Reintro): Pastel yellow (#FFF3B0)

&nbsp; - Phase 5 (Retest): Pastel blue (#A2D2FF)

&nbsp; - Phase 6 (Optimization): Pastel pink (#FFAFCC)

&nbsp; - Phase 7 (Maintenance): Soft sage (#C7DFC5)

\- Text: Warm charcoal (#2D2A32)

\- Accents: Muted gold (#D4A574)



\*\*Dark Mode:\*\*

\- Background: Deep navy (#0F0E17) with subtle aurora gradient shifts

\- Bubble colors: Same hues but deeper/richer — increase saturation by 15%, decrease lightness by 20%

&nbsp; - Phase 0: Deep coral (#E07A6B)

&nbsp; - Phase 1: Burnt peach (#D4967E)

&nbsp; - Phase 2: Deep lavender (#9B72CF)

&nbsp; - Phase 3: Emerald (#5BBF8A)

&nbsp; - Phase 4: Amber (#E0C44A)

&nbsp; - Phase 5: Steel blue (#5B8BC9)

&nbsp; - Phase 6: Rose (#D46A8C)

&nbsp; - Phase 7: Forest sage (#7BA87B)

\- Text: Soft white (#FFFFFE)

\- Accents: Copper (#C49A6C)



\*\*Color Assignment Rule:\*\* Each phase gets its own color. Bubbles within a phase use that phase's color at varying opacities (100% for the main phase bubble, 70-85% for sub-bubbles). Completed items shift toward a unified "done" color (muted silver-green in light mode, muted teal in dark mode) to visually separate past from present/future.



\### 2.3 Typography

\- Primary: Inter (clean, modern, highly legible on mobile)

\- Accent/Labels: Space Grotesk (slightly more personality for bubble labels)

\- Monospace (for data/stats): JetBrains Mono



\### 2.4 Shape Language

\- All containers are organic blobs — use SVG path morphing or CSS blob shapes

\- No sharp corners anywhere in the UI (minimum border-radius: 24px on any rectangular fallback)

\- Buttons are pill-shaped or circular

\- Panels that appear on screen are blob-shaped with soft membrane edges

\- When UI elements appear, they "grow" into existence (scale from 0 with spring physics)

\- When they disappear, they "shrink" or "dissolve"



\### 2.5 Animation Principles

\- Everything uses spring physics (Framer Motion spring config: stiffness 100-200, damping 15-25)

\- Idle state: All visible bubbles have subtle floating motion (sine wave drift, 0.5-2px amplitude, 3-8s period, randomized per bubble)

\- Background: Slow-moving gradient that shifts over 30-60 second cycles

\- Transitions between views: 400-600ms with easing

\- Never use linear easing — always spring or ease-out

\- Loading states: Pulsing glow on the relevant bubble



---



\## 3. BUBBLE MAP (Home View)



\### 3.1 Layout Engine

Use D3.js force simulation to position bubbles organically. The simulation should:

\- Center the currently active milestone on screen

\- Position related milestones (same phase) closer together

\- Position sequential phases in a roughly chronological flow (left-to-right or top-to-bottom)

\- Allow free panning and zooming (pinch on mobile, scroll on desktop)

\- Re-center on active milestone with a button tap



\### 3.2 Bubble Properties

Each bubble represents a milestone or action group. Properties:

\- \*\*Size\*\*: Proportional to the number of action items within (more items = bigger bubble)

\- \*\*Color\*\*: Determined by phase (see 2.2)

\- \*\*Border/Membrane\*\*: Subtle animated border that "breathes" (slight scale oscillation)

\- \*\*State indicators\*\*:

&nbsp; - Not started: Base color, slightly transparent (opacity 0.6)

&nbsp; - In progress: Full opacity, subtle pulsing glow

&nbsp; - Completed: "Done" color (silver-green / teal), slightly smaller, stops pulsing

&nbsp; - Overdue/Needs attention: Orange or red glow ring (this replaces traditional notifications)

&nbsp; - Blocked (dependency not met): Dimmed with a subtle chain-link icon overlay

\- \*\*Label\*\*: Short title on the bubble face, readable at default zoom

\- \*\*Progress ring\*\*: Thin circular progress indicator around the bubble edge showing % of action items complete



\### 3.3 Connections Between Bubbles

\- Dependencies shown as soft, curved lines between bubbles (not straight)

\- Lines use the same organic aesthetic — slightly wavy, like membrane bridges between cells

\- Line opacity indicates dependency strength (hard dependency = more opaque, soft/optional = more transparent)

\- Completed dependency lines turn to the "done" color



\### 3.4 Interaction

\- \*\*Tap bubble\*\*: Smooth zoom into the bubble, which expands to fill ~80% of the screen. Content appears inside.

\- \*\*Tap outside expanded bubble\*\*: Smooth zoom back out to map view

\- \*\*Pinch/scroll zoom\*\*: Zoom in and out of the map freely

\- \*\*Pan\*\*: Drag to pan around the bubble map

\- \*\*Re-center button\*\*: Floating pill button (bottom center) — "Go to current" — animates back to the active milestone



\### 3.5 Amoeba Split (Sub-Detail Bubbles)

When viewing an expanded milestone, certain stat blocks (like "Average Mood Score" or "Weight Trend") are displayed as smaller bubbles within the expanded view. Tapping one of these:

\- The sub-bubble visually "splits off" from the parent (amoeba division animation — membrane stretches, pinches, separates)

\- The view pans to center on the new sub-bubble

\- The sub-bubble expands to show detailed data (chart, breakdown, etc.)

\- The parent bubble remains visible but slightly behind/smaller

\- Tapping outside or a back gesture merges the sub-bubble back into the parent (reverse amoeba animation)



---



\## 4. MILESTONE DETAIL VIEW (Expanded Bubble)



\### 4.1 Content Sections

When a bubble is expanded, show:



\*\*Header Area:\*\*

\- Phase name + milestone title

\- Phase color gradient background

\- Completion percentage (circular progress or fraction)

\- Date range (expected start → expected end, dynamically adjusted)



\*\*Checklist:\*\*

\- All action items for this milestone as tappable checkboxes

\- Checked items visually recede (lower opacity, strikethrough)

\- Unchecked items are prominent

\- Each item can have a small note/date attached (when it was completed)



\*\*Quick Stats (as sub-bubbles that can split off):\*\*

\- Relevant metrics for this phase (varies by milestone — e.g., Phase 2 shows "Days into antibiotics: X/14", Phase 4 shows "Foods successfully reintroduced: X")

\- These are the amoeba-split targets described in 3.5



\*\*Notes/Log:\*\*

\- Free-text area for personal notes

\- Timestamped entries

\- AI-generated summaries from Cyto can appear here too



\*\*Cyto Chat Entry Point:\*\*

\- Small floating chat bubble within the expanded view (Cyto's icon)

\- Tap to open the Cyto chat with this milestone's context pre-loaded



\### 4.2 Responsive Layout

\- On mobile: Full-screen expanded view, scroll vertically within the bubble

\- On desktop: Bubble expands to 70-80% of viewport, map visible behind at reduced opacity



---



\## 5. TIMELINE INTELLIGENCE (Dynamic Adjustment)



\### 5.1 Dependency Graph

Define a dependency graph in `dependencies.ts`:

\- Each action item has: `id`, `phase`, `blocksDownstream: boolean`, `dependsOn: string\[]`

\- If an item with `blocksDownstream: true` is not completed by its expected date, all downstream dependent items shift forward by the delay

\- If an item does NOT block downstream items, it can be late without cascading



\### 5.2 Date Calculation

\- Each phase has a default start date relative to the previous phase's completion

\- The system calculates expected dates by walking the dependency graph forward from today

\- When items are completed, the graph recalculates — early completion pulls dates forward, late completion pushes them back

\- Dates shown on bubbles (when zoomed out) update in real-time as items are checked/unchecked



\### 5.3 Visual Indicators

\- Bubbles for milestones that are on track: Normal state

\- Bubbles for milestones that are delayed due to incomplete dependencies: Orange glow

\- Bubbles for milestones that are severely delayed (>7 days): Red glow

\- These glows are what trigger Cyto to send nudges via Telegram (the web app provides the data, OpenClaw consumes it)



---



\## 6. DAILY LOGGING



\### 6.1 What Gets Logged

Each day, the user can log:

\- \*\*Energy\*\* (1-10 scale, simple slider)

\- \*\*Brain Fog\*\* (1-10 scale, simple slider)

\- \*\*Mood\*\* (1-10 scale, simple slider — no emoji faces)

\- \*\*Sleep quality\*\* (1-10 scale, simple slider)

\- \*\*Flare occurrence\*\* (yes/no toggle, with severity 1-5 if yes, and optional trigger note)

\- \*\*Weight\*\* (numeric input, lbs)

\- \*\*Foods eaten\*\* (free text or quick-add from known food list)

\- \*\*Notes\*\* (free text, anything the user wants to record)



\### 6.2 Logging UI

\- Accessed via a floating "+" button on the map view (always visible, bottom-right)

\- Opens as a floating organic panel (blob-shaped, not a modal box)

\- Panel slides/grows into view with spring animation

\- Sliders are custom-styled to match the organic theme (round handles, pastel track colors)

\- Can log for today or backfill previous days

\- Auto-saves as the user inputs (no "submit" button — changes persist immediately)



\### 6.3 Data Storage

\- All logs stored in IndexedDB via a thin wrapper (e.g., Dexie.js)

\- Schema: `{ date: string (YYYY-MM-DD), energy: number, fog: number, mood: number, sleep: number, flare: boolean, flareSeverity?: number, flareTrigger?: string, weight?: number, foods: string\[], notes: string }`

\- Data is exportable as JSON from settings



---



\## 7. ANALYTICS DASHBOARD



\### 7.1 Access

\- Accessed via a floating "chart" button on the map view (bottom-left, opposite the log button)

\- Opens as a full-screen overlay with organic blob background

\- Has tabs or scrollable sections for different data views



\### 7.2 Charts \& Visualizations



\*\*7.2.1 Trend Lines (Recharts)\*\*

\- Energy over last 30 days (line chart, pastel coral)

\- Brain fog over last 30 days (line chart, pastel lavender)

\- Mood over last 30 days (line chart, pastel pink)

\- Sleep quality over last 30 days (line chart, pastel blue)

\- All four can overlay on a single chart or be viewed individually (toggle)

\- Weight trend (separate line chart, pastel mint)

\- X-axis: dates. Y-axis: score (1-10) or weight (lbs). Smooth curves, not jagged lines.



\*\*7.2.2 Food Tolerance Tracker (Line Chart)\*\*

\- Y-axis: percentage (0-100%) representing "how close to full dietary freedom"

\- X-axis: time

\- Starts at whatever percentage the current safe food list represents vs. a baseline of ~50 common foods

\- Each successfully reintroduced food bumps the line up

\- Each failed reintroduction (food causes flare) is marked as a red dot on the chart

\- Target: 100% = full dietary flexibility



\*\*7.2.3 Flare Calendar (Heat Map)\*\*

\- Monthly calendar view

\- Days with flares are colored by severity (light orange = mild, deep red = severe)

\- Days without flares are soft green

\- Tap a day to see the flare details (trigger, severity, notes)



\*\*7.2.4 Milestone Completion Rate\*\*

\- Overall percentage across all phases

\- Per-phase percentage breakdown

\- Visual: horizontal stacked bar or radial progress chart



\*\*7.2.5 Supplement Count (Fun Tracker)\*\*

\- Simple count of active daily supplements

\- Small line chart showing if the count goes up or down over time

\- Styled tongue-in-cheek in Cyto's voice ("Your daily supplement haul: 17 items. You're basically a pharmacy.")



\### 7.3 Responsive Design

\- On mobile: Single-column scrollable, charts resize to full width

\- On desktop: Two-column grid for charts, more breathing room



---



\## 8. CYTO AI COACH (In-App Chat)



\### 8.1 Architecture

\- Uses Anthropic API (Claude Opus 4.6) via direct API call from the client

\- API key stored in localStorage (entered in settings, never hardcoded)

\- No backend proxy — direct client-to-API calls (acceptable for single-user personal app)



\### 8.2 System Prompt

The Cyto AI coach receives a system prompt that includes:

\- Willem's full health context (conditions, labs, protocol, current phase)

\- The current state of the roadmap (which items are complete, which are pending, current phase)

\- Recent daily logs (last 7 days of energy/fog/mood/sleep/flare/weight data)

\- Personality directive: "You are Cyto, Willem's health recovery coach. You're direct, you don't sugarcoat things, and you push him when he's slacking. You're like a best friend who genuinely cares but isn't afraid to call him out. When he's doing well, you hype him up. When he's falling behind, you get on his case — not mean, but firm and honest. You know his full medical history and protocol. You never give generic wellness advice. Everything you say is grounded in HIS specific data and situation. You ARE the app — you're the living organism that wraps around his health journey, and you take that responsibility seriously."

\- Instruction: "When Willem asks to make changes to his roadmap (add items, remove items, adjust dates, mark things complete), output a structured JSON action block that the app will parse and execute. Always refer to yourself as Cyto. Format: { action: 'add\_item' | 'remove\_item' | 'complete\_item' | 'update\_date' | 'add\_note', target: '<item\_id>', data: {} }"



\### 8.3 Chat UI

\- Floating chat panel (organic blob shape, grows from the Cyto chat button)

\- Message bubbles are soft rounded rectangles with phase-colored accents

\- User messages on right, Cyto on left

\- Typing indicator: Three dots that pulse organically (Cyto is thinking...)

\- Chat history persists in IndexedDB

\- Can be opened from the map view (general chat with Cyto) or from within an expanded milestone (pre-loaded with that milestone's context)



\### 8.4 Cyto-Driven Roadmap Edits

When Cyto outputs a JSON action block in its response:

\- The app parses the action

\- Displays a confirmation card: "Cyto wants to: \[description of change]. Apply?"

\- If confirmed, the change is applied to the roadmap data and the bubble map updates in real-time

\- This allows natural language roadmap editing: "Hey, I was able to eat eggs today without any reaction" → Cyto outputs action to mark egg reintroduction as complete + updates food tolerance tracker



\### 8.5 Webhook/API Endpoint for OpenClaw

Cyto exposes a simple data endpoint (or the data is written to a JSON file on Railway that OpenClaw can fetch) so the OpenClaw Telegram agent can:

\- Read current roadmap state (what's complete, what's overdue, what's next)

\- Read recent daily logs

\- Know which phase Willem is in

\- Use this data to generate contextual Telegram nudges



Implementation: A `/api/state` endpoint (or a regularly-updated `state.json` in the public directory) that returns the current Cyto app state. OpenClaw fetches this periodically.



---



\## 9. SETTINGS



\### 9.1 Access

\- Gear icon (floating, top-right, small and unobtrusive)

\- Opens as floating organic panel



\### 9.2 Options

\- \*\*Theme toggle\*\*: Light mode / Dark mode (animated toggle switch)

\- \*\*Anthropic API key\*\*: Text input, stored in localStorage, masked

\- \*\*Data export\*\*: Button to export all data (logs, roadmap state, chat history) as JSON

\- \*\*Data import\*\*: Button to import previously exported JSON

\- \*\*Health context editor\*\*: View and edit the health context document that feeds Cyto's AI system prompt

\- \*\*Reset\*\*: Nuclear option to clear all data (with confirmation)



---



\## 10. DATA MODEL



\### 10.1 Roadmap Data (roadmap.ts)

```typescript

interface Phase {

&nbsp; id: string;

&nbsp; name: string;

&nbsp; color: string; // hex

&nbsp; defaultStartOffset: number; // days after protocol start

&nbsp; defaultDuration: number; // days

}



interface ActionItem {

&nbsp; id: string;

&nbsp; phaseId: string;

&nbsp; title: string;

&nbsp; description?: string;

&nbsp; completed: boolean;

&nbsp; completedDate?: string; // ISO date

&nbsp; dueDate?: string; // ISO date (calculated)

&nbsp; blocksDownstream: boolean;

&nbsp; dependsOn: string\[]; // IDs of items that must complete first

&nbsp; category: 'test' | 'medication' | 'supplement' | 'diet' | 'lifestyle' | 'peptide' | 'consultation';

}



interface Milestone {

&nbsp; id: string;

&nbsp; phaseId: string;

&nbsp; title: string;

&nbsp; description: string;

&nbsp; actionItems: ActionItem\[];

&nbsp; expectedStartDate: string; // calculated

&nbsp; expectedEndDate: string; // calculated

}

```



\### 10.2 Daily Log Data

```typescript

interface DailyLog {

&nbsp; date: string; // YYYY-MM-DD

&nbsp; energy: number; // 1-10

&nbsp; fog: number; // 1-10

&nbsp; mood: number; // 1-10

&nbsp; sleep: number; // 1-10

&nbsp; flare: boolean;

&nbsp; flareSeverity?: number; // 1-5

&nbsp; flareTrigger?: string;

&nbsp; weight?: number; // lbs

&nbsp; foods: string\[];

&nbsp; notes: string;

&nbsp; timestamp: number; // when the log was created/updated

}

```



\### 10.3 Chat History

```typescript

interface ChatMessage {

&nbsp; id: string;

&nbsp; role: 'user' | 'assistant';

&nbsp; content: string;

&nbsp; timestamp: number;

&nbsp; milestoneContext?: string; // which milestone was open when this message was sent

&nbsp; actions?: RoadmapAction\[]; // parsed Cyto AI actions, if any

}

```



---



\## 11. ROADMAP DATA (Pre-populated)



The app ships pre-loaded with Willem's actual recovery roadmap. All phases, milestones, and action items from the health\_roadmap.md document must be encoded into roadmap.ts. Here is the complete data:



\### Phase 0 — Immediate (Feb 13–20, 2026)

\*\*Milestone: Diagnostic Baseline\*\*

Action items:

\- \[ ] Start cetirizine 10mg daily (morning)

\- \[ ] Start famotidine 20mg BID (morning + evening)

\- \[ ] Order bloodwork (CBC, CMP, ferritin, B12, TSH, A1c, CRP, quantitative immunoglobulins)

\- \[ ] Order baseline serum tryptase (fasting)

\- \[ ] Order H. pylori stool antigen test

\- \[ ] Get Freestyle Libre 3 CGM (14-day sensor)

\- \[ ] Perform orthostatic vitals test at home

\- \[ ] Begin daily symptom logging (energy, fog, mood, flares)

Category: test/medication. All items block Phase 1.



\### Phase 1 — Assess + Decide (Feb 20–28, 2026)

\*\*Milestone: Interpret Results\*\*

Action items:

\- \[ ] Review H1/H2 blocker trial results (≥50% flare reduction = positive)

\- \[ ] Review bloodwork results — flag abnormals

\- \[ ] Review H. pylori stool antigen result

\- \[ ] Review CGM data for reactive hypoglycemia

\- \[ ] Review tryptase result

\- \[ ] Make go/no-go decision on bismuth quadruple therapy

Depends on: All Phase 0 items. Blocks Phase 2.



\### Phase 2 — H. pylori Eradication (Early–Mid March 2026, 14 days)

\*\*Milestone: Antibiotic Protocol\*\*

Action items:

\- \[ ] Get prescription for bismuth quadruple therapy

\- \[ ] Get S. boulardii probiotic

\- \[ ] Hold mineral supplements (multivitamin, mineral caps, magnesium) for 14 days

\- \[ ] Pause GHK-Cu for 14 days

\- \[ ] Continue CJC/Ipa unchanged

\- \[ ] Continue H1/H2 blockers

\- \[ ] Track daily: weight, energy, GI symptoms, brain fog

\- \[ ] Complete 14-day antibiotic course

\- \[ ] Watch weight floor (flag if <140 lbs)

Depends on: Phase 1 go decision. Blocks Phase 3.



\### Phase 3 — Early Restoration (Late March–Mid April 2026)

\*\*Milestone: Rebuild Gut\*\*

Action items:

\- \[ ] Resume GHK-Cu (3-5 days post-antibiotics)

\- \[ ] Resume mineral supplements

\- \[ ] Continue S. boulardii 1-2 more weeks

\- \[ ] Start butyrate supplementation

\- \[ ] Consider SBI (MegaIgG2000)

\- \[ ] Begin conservative probiotic introduction (one strain every 5-7 days)

\- \[ ] Discuss Thymosin Alpha-1 with prescribing physician

Depends on: Phase 2 completion. Blocks Phase 4.



\### Phase 4 — Food Reintroduction (Mid April–Late May 2026)

\*\*Milestone: Systematic Diet Expansion\*\*

Action items (food trials — one every 3-4 days):

\- Tier 1: Eggs, salmon, avocado, chicken, beef, sweet potato, zucchini, olive oil, blueberries

\- Tier 2: White potato, broccoli, cauliflower, spinach, banana, apple, oats

\- Tier 3: Almonds, pumpkin seeds, chia seeds, lettuce, ginger, green tea

\- Tier 4 (last): Legumes, sesame, rice, octopus

Each food is an individual action item with pass/fail outcome.

Depends on: Phase 3. Does not strictly block Phase 5 (can overlap).



\### Phase 5 — Retest + Reassess (Mid May 2026)

\*\*Milestone: Confirm Progress\*\*

Action items:

\- \[ ] H. pylori stool antigen retest (≥4 weeks post-antibiotics)

\- \[ ] Hold PPI 2 weeks before retest

\- \[ ] Repeat sIgA and calprotectin

\- \[ ] Discuss cromolyn sodium if H1/H2 worked

\- \[ ] Begin H1/H2 blocker taper

\- \[ ] Consider KPV retry (500mcg 1-2x daily, oral enteric-coated)

\- \[ ] Consider BPC-157 (conditional on tryptase results)

Depends on: Phase 2 completion + 4 weeks. Some items depend on Phase 1 tryptase results.



\### Phase 6 — Optimization (June–August 2026)

\*\*Milestone: Expand + Strengthen\*\*

Action items:

\- \[ ] Continue food reintroduction through Tier 3

\- \[ ] Test restaurant meals (simple orders first)

\- \[ ] Target 155 lbs

\- \[ ] Track weekly weigh-ins

\- \[ ] Consider Selank if cognitive symptoms persist

\- \[ ] Repeat full GI-MAP at 6 months post-antibiotics

Depends on: Phase 4 + Phase 5.



\### Phase 7 — Long-Term Maintenance (August 2026–February 2027)

\*\*Milestone: Sustained Recovery\*\*

Action items:

\- \[ ] Eating broadly with confidence

\- \[ ] Weight stable at 155+ lbs

\- \[ ] Illness frequency ≤4x/year

\- \[ ] No regular food-triggered flares

\- \[ ] Taper/discontinue H1/H2 blockers

\- \[ ] Taper/discontinue S. boulardii and probiotics

\- \[ ] Taper/discontinue butyrate and SBI

\- \[ ] Reassess Tα1 at 6 months

\- \[ ] Maintain core supplement stack (omega-3, D3/K2, magnesium, NAC)

Depends on: Phase 6.



---



\## 12. HEALTH CONTEXT DOCUMENT



Store this in `healthContext.ts` as a string that gets injected into the Cyto AI system prompt. Cyto can suggest edits to this document via chat actions.

PATIENT: Willem, 22M, 6'1", 145 lbs

CHIEF COMPLAINTS: Food-triggered systemic flares (malaise, brain fog, warm flush, post-nasal drip, shakiness, tachycardia within ~1 hour of trigger foods), low baseline energy, mild brain fog

KEY LAB FINDINGS:



H. pylori positive (3.53e3), all virulence factors negative, clarithromycin resistant

IMO positive (methane 12.64 ppm)

sIgA: 3253 (severely elevated, ref 510-2010)

Calprotectin: 150 (upper normal)

β-Glucuronidase: 3030 (elevated)

Dysbiotic overgrowth: Pseudomonas (17x), Staph aureus (5.6x), Streptococcus (92x), Enterobacter (3.7x)

IgG food sensitivities: Legume cluster (high), rice (moderate, confirmed trigger)

CURRENT MEDICATIONS/SUPPLEMENTS: \[see supplement stack in roadmap]

CURRENT PEPTIDES: CJC-1295/Ipamorelin (200/200mcg pre-bed, 5 on/2 off), GHK-Cu (1-2mg morning, daily)

SAFE FOODS: \[to be populated by user]

TRIGGER FOODS: Rice, legumes (confirmed). Others under investigation.

LAST UPDATED: February 13, 2026





---



\## 13. IMPLEMENTATION PRIORITIES



Build in this order:

1\. Project scaffolding (Vite + React + TypeScript + Tailwind + Framer Motion)

2\. Theme system (light/dark with pastel palettes, animated background gradients)

3\. Data layer (Zustand store + IndexedDB with Dexie.js, pre-populated roadmap data)

4\. Bubble map (D3 force simulation, bubble rendering, idle animations, pan/zoom)

5\. Milestone detail view (expand animation, checklist, notes)

6\. Daily logging UI (floating panel, sliders, inputs)

7\. Analytics dashboard (Recharts charts, food tolerance tracker, flare calendar)

8\. Cyto AI chat (Anthropic API integration, system prompt assembly, action parsing)

9\. Amoeba split animation (sub-detail bubbles breaking off)

10\. Settings panel (theme toggle, API key, export/import)

11\. Timeline intelligence (dependency graph, date recalculation, glow states)

12\. OpenClaw data endpoint (state.json or API route for Cyto/OpenClaw external consumption)

13\. Polish pass (animation timing, responsive fixes, performance optimization)

