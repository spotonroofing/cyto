// Dependency graph — Spec Section 5.1
// Maps phase IDs to the phases they depend on

export const phaseDependencies: Record<string, string[]> = {
  'phase-0': [],
  'phase-1': ['phase-0'],
  'phase-2': ['phase-1'],
  'phase-3': ['phase-2'],
  'phase-4': ['phase-3'],
  'phase-5': ['phase-2'], // 4 weeks post-antibiotics, some items depend on Phase 1
  'phase-6': ['phase-4', 'phase-5'],
  'phase-7': ['phase-6'],
}

// Which milestones block which downstream milestones
export const milestoneDependencies: Record<string, string[]> = {
  'ms-diagnostic-baseline': ['ms-interpret-results'],
  'ms-interpret-results': ['ms-antibiotic-protocol'],
  'ms-antibiotic-protocol': ['ms-rebuild-gut', 'ms-confirm-progress'],
  'ms-rebuild-gut': ['ms-diet-expansion'],
  'ms-diet-expansion': ['ms-expand-strengthen'],
  'ms-confirm-progress': ['ms-expand-strengthen'],
  'ms-expand-strengthen': ['ms-sustained-recovery'],
  'ms-sustained-recovery': [],
}
