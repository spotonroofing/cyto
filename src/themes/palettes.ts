// Cyto Theme Palette Definitions
// Every theme has a light and dark variant.
// phaseColors has 8 entries (one per phase 0-7).
// goo/nucleus are opacity values (0-1) controlling how the phase color
// is rendered for the membrane and nucleus layers on the canvas.

export interface ThemePalette {
  bg: string
  surface: string
  text: string
  textSecondary: string
  accent: string
  done: string
  goo: number           // goo membrane layer opacity (0-1)
  nucleus: number       // nucleus fill opacity (0-1)
  phaseColors: string[] // 8 colors, one per phase
  buttonBg: string
  buttonText: string
  menuBg: string
  menuText: string
  border: string
  backdrop: string
  particle: string      // ambient particle base color (rgb, no alpha)
  ring: string          // petri dish ring base color (rgb, no alpha)
  metaThemeColor: string
}

export interface Theme {
  id: string
  name: string
  light: ThemePalette
  dark: ThemePalette
}

// ─── Theme 1: Cytoplasm (default — matches current app exactly) ─────────

const cytoplasm: Theme = {
  id: 'cytoplasm',
  name: 'Cytoplasm',
  light: {
    bg: '#FFF8F7',
    surface: '#FFF8F7',
    text: '#2D2A32',
    textSecondary: 'rgba(45,42,50,0.5)',
    accent: '#C0907A',
    done: '#B5C4B1',
    goo: 0.32,
    nucleus: 0.55,
    phaseColors: [
      '#E09888', // 0 Warm Coral — Immediate
      '#D09BA8', // 1 Dusty Rose — Assess
      '#B898B8', // 2 Soft Mauve — Eradication
      '#CCB090', // 3 Warm Clay — Restoration
      '#C4A080', // 4 Terracotta — Food Reintro
      '#B0A0B0', // 5 Dusty Taupe — Retest
      '#D0A098', // 6 Rose Clay — Optimization
      '#A8A898', // 7 Warm Stone — Maintenance
    ],
    buttonBg: '#FFF8F7',
    buttonText: '#2D2A32',
    menuBg: '#FFF8F7',
    menuText: '#2D2A32',
    border: 'rgba(0,0,0,0.08)',
    backdrop: 'rgba(255,248,240,0.7)',
    particle: 'rgb(200,160,140)',
    ring: 'rgb(200,160,150)',
    metaThemeColor: '#FFF8F7',
  },
  dark: {
    bg: '#0F0E17',
    surface: '#18162A',
    text: '#FFFFFE',
    textSecondary: 'rgba(255,255,254,0.5)',
    accent: '#A07060',
    done: '#4A8B7F',
    goo: 0.32,
    nucleus: 0.55,
    phaseColors: [
      '#B86850', // 0 Deep Coral
      '#986070', // 1 Deep Rose
      '#705070', // 2 Deep Mauve (darkened for text contrast)
      '#A08050', // 3 Deep Clay
      '#907048', // 4 Deep Terracotta
      '#706878', // 5 Deep Taupe
      '#A06858', // 6 Deep Rose Clay
      '#688060', // 7 Deep Sage Stone
    ],
    buttonBg: '#18162A',
    buttonText: '#FFFFFE',
    menuBg: '#18162A',
    menuText: '#FFFFFE',
    border: 'rgba(255,255,255,0.08)',
    backdrop: 'rgba(15,14,23,0.7)',
    particle: 'rgb(160,120,100)',
    ring: 'rgb(160,120,110)',
    metaThemeColor: '#0F0E17',
  },
}

// ─── Theme 2: Bioluminescent ────────────────────────────────────────────

const bioluminescent: Theme = {
  id: 'bioluminescent',
  name: 'Bioluminescent',
  light: {
    bg: '#EFF4F8',
    surface: '#E4ECF2',
    text: '#1A2B3C',
    textSecondary: 'rgba(26,43,60,0.5)',
    accent: '#0097B2',
    done: '#66CDAA',
    goo: 0.35,
    nucleus: 0.6,
    phaseColors: [
      '#00A5C4', // 0 Cyan
      '#40B0D0', // 1 Sky
      '#70C8D8', // 2 Seafoam
      '#00C4A0', // 3 Teal-green
      '#60D0B0', // 4 Jade
      '#2E9E5A', // 5 Emerald
      '#8878C8', // 6 Soft purple
      '#C070A0', // 7 Orchid
    ],
    buttonBg: '#E4ECF2',
    buttonText: '#1A2B3C',
    menuBg: '#E4ECF2',
    menuText: '#1A2B3C',
    border: 'rgba(0,40,80,0.1)',
    backdrop: 'rgba(239,244,248,0.8)',
    particle: 'rgb(100,170,190)',
    ring: 'rgb(80,150,170)',
    metaThemeColor: '#EFF4F8',
  },
  dark: {
    bg: '#040E18',
    surface: '#0A1828',
    text: '#D8F0F8',
    textSecondary: 'rgba(216,240,248,0.5)',
    accent: '#00D4FF',
    done: '#50E8A8',
    goo: 0.40,
    nucleus: 0.65,
    phaseColors: [
      '#00CCEE', // 0 Electric cyan
      '#18D8F0', // 1 Bright cyan
      '#50E0C8', // 2 Bright teal
      '#00D480', // 3 Neon green
      '#60F090', // 4 Lime
      '#7050E0', // 5 Vivid purple
      '#D040C0', // 6 Magenta
      '#F04888', // 7 Hot pink
    ],
    buttonBg: '#0A1828',
    buttonText: '#D8F0F8',
    menuBg: '#0A1828',
    menuText: '#D8F0F8',
    border: 'rgba(0,200,238,0.12)',
    backdrop: 'rgba(4,14,24,0.85)',
    particle: 'rgb(0,100,140)',
    ring: 'rgb(0,80,120)',
    metaThemeColor: '#040E18',
  },
}

// ─── Theme 3: Forest Floor ──────────────────────────────────────────────

const forest: Theme = {
  id: 'forest',
  name: 'Forest Floor',
  light: {
    bg: '#F2EEE4',
    surface: '#EAE4D8',
    text: '#2C3E2D',
    textSecondary: 'rgba(44,62,45,0.5)',
    accent: '#7B6B3A',
    done: '#7BA87B',
    goo: 0.30,
    nucleus: 0.55,
    phaseColors: [
      '#88B888', // 0 Sage
      '#A0C080', // 1 Fern
      '#688850', // 2 Moss
      '#C4A060', // 3 Bark gold
      '#907058', // 4 Walnut
      '#A87088', // 5 Mushroom
      '#90A880', // 6 Lichen
      '#78A058', // 7 Leaf
    ],
    buttonBg: '#EAE4D8',
    buttonText: '#2C3E2D',
    menuBg: '#EAE4D8',
    menuText: '#2C3E2D',
    border: 'rgba(44,62,45,0.1)',
    backdrop: 'rgba(242,238,228,0.8)',
    particle: 'rgb(150,170,120)',
    ring: 'rgb(130,150,100)',
    metaThemeColor: '#F2EEE4',
  },
  dark: {
    bg: '#0C1A0A',
    surface: '#142412',
    text: '#D0DCC8',
    textSecondary: 'rgba(208,220,200,0.5)',
    accent: '#B8A050',
    done: '#508850',
    goo: 0.35,
    nucleus: 0.60,
    phaseColors: [
      '#508850', // 0 Deep sage
      '#6E9838', // 1 Olive
      '#406830', // 2 Forest
      '#A88030', // 3 Amber
      '#604020', // 4 Dark bark
      '#804870', // 5 Plum
      '#587840', // 6 Deep lichen
      '#408030', // 7 Dark fern
    ],
    buttonBg: '#142412',
    buttonText: '#D0DCC8',
    menuBg: '#142412',
    menuText: '#D0DCC8',
    border: 'rgba(180,200,150,0.1)',
    backdrop: 'rgba(12,26,10,0.85)',
    particle: 'rgb(70,110,50)',
    ring: 'rgb(60,90,40)',
    metaThemeColor: '#0C1A0A',
  },
}

// ─── Theme 4: Ember ─────────────────────────────────────────────────────

const ember: Theme = {
  id: 'ember',
  name: 'Ember',
  light: {
    bg: '#F8F0EA',
    surface: '#F0E4DA',
    text: '#3A2420',
    textSecondary: 'rgba(58,36,32,0.5)',
    accent: '#C85A28',
    done: '#8EA858',
    goo: 0.30,
    nucleus: 0.55,
    phaseColors: [
      '#D87048', // 0 Flame
      '#C85A28', // 1 Ember
      '#E8A060', // 2 Amber
      '#B83828', // 3 Crimson
      '#D88030', // 4 Orange
      '#B86838', // 5 Sienna
      '#A85030', // 6 Rust
      '#904828', // 7 Burnt umber
    ],
    buttonBg: '#F0E4DA',
    buttonText: '#3A2420',
    menuBg: '#F0E4DA',
    menuText: '#3A2420',
    border: 'rgba(58,36,32,0.1)',
    backdrop: 'rgba(248,240,234,0.8)',
    particle: 'rgb(200,140,100)',
    ring: 'rgb(180,120,90)',
    metaThemeColor: '#F8F0EA',
  },
  dark: {
    bg: '#180C08',
    surface: '#281810',
    text: '#F0D8C8',
    textSecondary: 'rgba(240,216,200,0.5)',
    accent: '#F06828',
    done: '#70A038',
    goo: 0.38,
    nucleus: 0.60,
    phaseColors: [
      '#F06020', // 0 Bright flame
      '#E04000', // 1 Hot orange
      '#C08030', // 2 Amber (darkened for text contrast)
      '#E02020', // 3 Red
      '#F08800', // 4 Vivid orange
      '#D05010', // 5 Deep orange
      '#C04018', // 6 Dark sienna
      '#A83010', // 7 Deep rust
    ],
    buttonBg: '#281810',
    buttonText: '#F0D8C8',
    menuBg: '#281810',
    menuText: '#F0D8C8',
    border: 'rgba(240,104,40,0.12)',
    backdrop: 'rgba(24,12,8,0.85)',
    particle: 'rgb(140,60,20)',
    ring: 'rgb(120,50,15)',
    metaThemeColor: '#180C08',
  },
}

// ─── Theme 5: Aurora ────────────────────────────────────────────────────

const aurora: Theme = {
  id: 'aurora',
  name: 'Aurora',
  light: {
    bg: '#EEEAF6',
    surface: '#E4DEF0',
    text: '#2A2040',
    textSecondary: 'rgba(42,32,64,0.5)',
    accent: '#7050B8',
    done: '#58A060',
    goo: 0.30,
    nucleus: 0.55,
    phaseColors: [
      '#A050B8', // 0 Purple
      '#7050C0', // 1 Deep violet
      '#4090E0', // 2 Blue
      '#30B0C8', // 3 Cyan
      '#58A060', // 4 Green
      '#E0B830', // 5 Gold
      '#D85040', // 6 Coral
      '#D060A0', // 7 Pink
    ],
    buttonBg: '#E4DEF0',
    buttonText: '#2A2040',
    menuBg: '#E4DEF0',
    menuText: '#2A2040',
    border: 'rgba(42,32,64,0.1)',
    backdrop: 'rgba(238,234,246,0.8)',
    particle: 'rgb(140,120,190)',
    ring: 'rgb(120,100,170)',
    metaThemeColor: '#EEEAF6',
  },
  dark: {
    bg: '#08041C',
    surface: '#10082A',
    text: '#E0D8F8',
    textSecondary: 'rgba(224,216,248,0.5)',
    accent: '#A880F0',
    done: '#58E098',
    goo: 0.38,
    nucleus: 0.60,
    phaseColors: [
      '#C070E0', // 0 Lilac
      '#A078F0', // 1 Lavender
      '#50A0F0', // 2 Sky
      '#40C8D8', // 3 Aqua
      '#68C880', // 4 Sage
      '#B89820', // 5 Gold (darkened for text contrast)
      '#E85050', // 6 Coral
      '#E860A0', // 7 Rose
    ],
    buttonBg: '#10082A',
    buttonText: '#E0D8F8',
    menuBg: '#10082A',
    menuText: '#E0D8F8',
    border: 'rgba(168,128,240,0.12)',
    backdrop: 'rgba(8,4,28,0.85)',
    particle: 'rgb(70,50,130)',
    ring: 'rgb(60,40,110)',
    metaThemeColor: '#08041C',
  },
}

// ─── Theme 6: Ocean ─────────────────────────────────────────────────────

const ocean: Theme = {
  id: 'ocean',
  name: 'Ocean',
  light: {
    bg: '#EEF4F6',
    surface: '#E2EEF2',
    text: '#1A3040',
    textSecondary: 'rgba(26,48,64,0.5)',
    accent: '#0880B8',
    done: '#70B8B0',
    goo: 0.30,
    nucleus: 0.55,
    phaseColors: [
      '#E07870', // 0 Coral
      '#40A8D8', // 1 Sky blue
      '#60C8D0', // 2 Turquoise
      '#40A098', // 3 Teal
      '#90C068', // 4 Kelp
      '#E0C050', // 5 Sand
      '#A868B8', // 6 Anemone
      '#8098A8', // 7 Slate
    ],
    buttonBg: '#E2EEF2',
    buttonText: '#1A3040',
    menuBg: '#E2EEF2',
    menuText: '#1A3040',
    border: 'rgba(26,48,64,0.1)',
    backdrop: 'rgba(238,244,246,0.8)',
    particle: 'rgb(90,170,190)',
    ring: 'rgb(70,150,170)',
    metaThemeColor: '#EEF4F6',
  },
  dark: {
    bg: '#041420',
    surface: '#081E2E',
    text: '#C8E0EC',
    textSecondary: 'rgba(200,224,236,0.5)',
    accent: '#28B0F0',
    done: '#40A898',
    goo: 0.35,
    nucleus: 0.60,
    phaseColors: [
      '#E85050', // 0 Bright coral
      '#28A8F0', // 1 Vivid sky
      '#20C0D0', // 2 Bright cyan
      '#20A090', // 3 Deep teal
      '#88C050', // 4 Seagrass
      '#B8A028', // 5 Gold sand (darkened for text contrast)
      '#A040B0', // 6 Deep anemone
      '#688898', // 7 Dark slate
    ],
    buttonBg: '#081E2E',
    buttonText: '#C8E0EC',
    menuBg: '#081E2E',
    menuText: '#C8E0EC',
    border: 'rgba(40,176,240,0.12)',
    backdrop: 'rgba(4,20,32,0.85)',
    particle: 'rgb(20,90,120)',
    ring: 'rgb(15,70,100)',
    metaThemeColor: '#041420',
  },
}

// ─── Theme 7: Monochrome ────────────────────────────────────────────────

const monochrome: Theme = {
  id: 'monochrome',
  name: 'Monochrome',
  light: {
    bg: '#F4F3F2',
    surface: '#EAEAE8',
    text: '#222222',
    textSecondary: 'rgba(34,34,34,0.45)',
    accent: '#6E6E6E',
    done: '#909090',
    goo: 0.25,
    nucleus: 0.50,
    phaseColors: [
      '#B0B0B0', // 0 Silver
      '#989898', // 1 Medium
      '#808080', // 2 Gray
      '#A09088', // 3 Warm taupe
      '#887870', // 4 Warm dark
      '#788890', // 5 Cool steel
      '#8898A0', // 6 Slate
      '#A0A8B0', // 7 Pale steel
    ],
    buttonBg: '#EAEAE8',
    buttonText: '#222222',
    menuBg: '#EAEAE8',
    menuText: '#222222',
    border: 'rgba(0,0,0,0.10)',
    backdrop: 'rgba(244,243,242,0.8)',
    particle: 'rgb(180,180,180)',
    ring: 'rgb(160,160,160)',
    metaThemeColor: '#F4F3F2',
  },
  dark: {
    bg: '#141414',
    surface: '#1E1E1E',
    text: '#DADADA',
    textSecondary: 'rgba(218,218,218,0.45)',
    accent: '#909090',
    done: '#686868',
    goo: 0.30,
    nucleus: 0.55,
    phaseColors: [
      '#707070', // 0 Medium
      '#585858', // 1 Dark
      '#909090', // 2 Light
      '#7E6E66', // 3 Warm
      '#5E4E46', // 4 Dark warm
      '#4E5E66', // 5 Cool
      '#566670', // 6 Dark slate
      '#6E7880', // 7 Steel
    ],
    buttonBg: '#1E1E1E',
    buttonText: '#DADADA',
    menuBg: '#1E1E1E',
    menuText: '#DADADA',
    border: 'rgba(255,255,255,0.08)',
    backdrop: 'rgba(20,20,20,0.85)',
    particle: 'rgb(70,70,70)',
    ring: 'rgb(60,60,60)',
    metaThemeColor: '#141414',
  },
}

// ─── Export ─────────────────────────────────────────────────────────────

export const themes: Theme[] = [
  cytoplasm,
  bioluminescent,
  forest,
  ember,
  aurora,
  ocean,
  monochrome,
]

export const defaultThemeId = 'cytoplasm'

export function getThemeById(id: string): Theme {
  return themes.find((t) => t.id === id) ?? themes[0]!
}
