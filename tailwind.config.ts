import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Space Grotesk', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        // Light mode phase colors
        phase: {
          0: '#E09888', // Warm Coral — Baseline/Immediate
          1: '#D09BA8', // Dusty Rose — Assess
          2: '#B898B8', // Soft Mauve — Eradication
          3: '#CCB090', // Warm Clay — Restoration
          4: '#C4A080', // Terracotta — Food Reintro
          5: '#B0A0B0', // Dusty Taupe — Retest
          6: '#D0A098', // Rose Clay — Optimization
          7: '#A8A898', // Warm Stone — Maintenance
        },
        // Dark mode phase colors
        'phase-dark': {
          0: '#B86850', // Deep Coral
          1: '#986070', // Deep Rose
          2: '#806080', // Deep Mauve
          3: '#A08050', // Deep Clay
          4: '#907048', // Deep Terracotta
          5: '#706878', // Deep Taupe
          6: '#A06858', // Deep Rose Clay
          7: '#688060', // Deep Sage Stone
        },
        // Theme colors
        cream: '#FFF8F7',
        navy: '#0F0E17',
        charcoal: '#2D2A32',
        softwhite: '#FFFFFE',
        gold: '#C0907A',
        copper: '#A07060',
        // Done colors
        'done-light': '#B5C4B1', // muted silver-green
        'done-dark': '#4A8B7F',  // muted teal
      },
      borderRadius: {
        blob: '24px',
      },
    },
  },
  plugins: [],
}

export default config
