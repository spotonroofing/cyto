# Cyto Web App — Feature Scope

## Overview
Personal health tracking app visualizing a 7-phase recovery roadmap as a biological "microscope view."

## Visual Theme
- Core: Organic, cellular, biological
- Aesthetic: "Microscope view" — orbs, membranes, floating particles
- Background: Cream #FFF5F2
- Buttons: Tinted with phase colors, organic membrane look
- Milestones: Distinct muted/pastel colors per phase

## Features

### 1. Milestone Map (Home) — [IN PROGRESS]
Left-to-right winding path of nodes representing recovery phases. Pan (drag) and Zoom (scroll/pinch). Starts zoomed on current phase. Deterministic layout with fork after Phase 2 and merge at Phase 6.

Nodes are "cells" with outer membrane (border-radius morphing) and inner nucleus. States: Active (pulsing/colored), Locked (dashed ring/spore), Complete.

Connections are "goo" / cytoplasm — thick organic fluid with flowing particle animations implying directionality.

### 2. Daily Log — [BUILT]
Input for Energy, Fog, Sleep, etc. Secondary to Telegram logging via agent.

### 3. Analytics — [BUILT]
Button in bottom-left. Shows Weight, Sleep, Energy, Fog, Mood, Flare Count.

### 4. Chat Interface — [BUILT / DEPRECATED]
Button remains but interaction is primarily via Telegram agent.

### 5. Settings — [BUILT]
Theme toggle, Data export/reset. API key input removed.

## Tech Stack
React (Vite) + TypeScript, Tailwind CSS, Zustand + Dexie (IndexedDB), Canvas (goo) + SVG (nuclei/labels/buttons), Framer Motion, Hono on Railway.
