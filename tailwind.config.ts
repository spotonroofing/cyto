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
          0: '#FFB5A7', // Soft coral — Immediate
          1: '#FCD5CE', // Pastel peach — Assess
          2: '#D8BBFF', // Lavender — Eradication
          3: '#B8F3D4', // Soft mint — Restoration
          4: '#FFF3B0', // Pastel yellow — Food Reintro
          5: '#A2D2FF', // Pastel blue — Retest
          6: '#FFAFCC', // Pastel pink — Optimization
          7: '#C7DFC5', // Soft sage — Maintenance
        },
        // Dark mode phase colors
        'phase-dark': {
          0: '#E07A6B', // Deep coral
          1: '#D4967E', // Burnt peach
          2: '#9B72CF', // Deep lavender
          3: '#5BBF8A', // Emerald
          4: '#E0C44A', // Amber
          5: '#5B8BC9', // Steel blue
          6: '#D46A8C', // Rose
          7: '#7BA87B', // Forest sage
        },
        // Theme colors
        cream: '#FFF5F2',
        navy: '#0F0E17',
        charcoal: '#2D2A32',
        softwhite: '#FFFFFE',
        gold: '#D4A574',
        copper: '#C49A6C',
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
