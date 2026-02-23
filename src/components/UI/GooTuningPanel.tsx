import { useState } from 'react'
import { useTuningStore, TUNING_DEFAULTS, type TuningKey } from '@/stores/tuningStore'
import { IS_MOBILE } from '@/utils/performanceTier'

interface SliderDef {
  key: TuningKey
  label: string
  min: number
  max: number
  step: number
}

interface Section {
  title: string
  sliders: SliderDef[]
}

const sections: Section[] = [
  {
    title: 'Goo',
    sliders: [
      { key: 'tubeWidthRatio',     label: 'Bridge Width',   min: 0.05, max: 0.60, step: 0.01 },
      { key: 'filletWidthRatio',   label: 'Fillet Ratio',   min: 0.5,  max: 3.0,  step: 0.1  },
      { key: 'blurStdDev',         label: 'Goo Halo',       min: 0,    max: 30,   step: 1    },
      { key: 'nucleusRatioSvg',    label: 'Nucleus Size',   min: 0.3,  max: 1.0,  step: 0.01 },
    ],
  },
  {
    title: 'Text & Icons',
    sliders: [
      { key: 'iconSizeRatio',          label: 'Icon Size', min: 0.1, max: 0.5, step: 0.01 },
      { key: 'phaseNameFontSize',      label: 'Name Size', min: 6,   max: 24,  step: 1    },
      { key: 'phaseIndicatorFontSize', label: 'P# Size',   min: 4,   max: 18,  step: 1    },
    ],
  },
  {
    title: 'Goo Filter',
    sliders: [
      { key: 'gooContrast',      label: 'Goo Contrast',  min: 1,   max: 40, step: 1   },
      { key: 'gooThreshold',     label: 'Goo Threshold', min: -20, max: 0,  step: 0.5 },
      { key: 'nucleusBlur',      label: 'Nuc Blur',      min: 0,   max: 15, step: 0.5 },
      { key: 'nucleusContrast',  label: 'Nuc Contrast',  min: 1,   max: 40, step: 1   },
      { key: 'nucleusThreshold', label: 'Nuc Threshold', min: -20, max: 0,  step: 0.5 },
    ],
  },
  {
    title: 'Edge Wobble',
    sliders: [
      { key: 'edgeWobbleSpeed', label: 'Wobble Spd', min: 0, max: 3, step: 0.05 },
      { key: 'edgeWobbleAmp',   label: 'Wobble Amp', min: 0, max: 3, step: 0.05 },
    ],
  },
  {
    title: 'Nucleus SVG',
    sliders: [
      { key: 'svgNucleusBreatheSpeed', label: 'Breathe Spd',  min: 0, max: 3,   step: 0.05  },
      { key: 'svgNucleusBreatheAmp',   label: 'Breathe Amp',  min: 0, max: 0.1, step: 0.005 },
      { key: 'svgNucleus2LobeSpeed',   label: '2-Lobe Spd',   min: 0, max: 3,   step: 0.05  },
      { key: 'svgNucleus2LobeAmp',     label: '2-Lobe Amp',   min: 0, max: 0.1, step: 0.005 },
      { key: 'svgNucleus3LobeSpeed',   label: '3-Lobe Spd',   min: 0, max: 3,   step: 0.05  },
      { key: 'svgNucleus3LobeAmp',     label: '3-Lobe Amp',   min: 0, max: 0.1, step: 0.005 },
      { key: 'svgNucleus5LobeSpeed',   label: '5-Lobe Spd',   min: 0, max: 3,   step: 0.05  },
      { key: 'svgNucleus5LobeAmp',     label: '5-Lobe Amp',   min: 0, max: 0.1, step: 0.005 },
      { key: 'nucleusOpacity',         label: 'Opacity',       min: 0, max: 1,   step: 0.05  },
    ],
  },
  {
    title: 'Membrane',
    sliders: [
      { key: 'membraneBreatheSpeed', label: 'Breathe Spd',  min: 0,  max: 3,  step: 0.05 },
      { key: 'membraneBreatheAmp',   label: 'Breathe Amp',  min: 0,  max: 10, step: 0.2  },
      { key: 'membraneDeformASpeed', label: 'Deform A Spd', min: 0,  max: 2,  step: 0.05 },
      { key: 'membraneDeformAAmp',   label: 'Deform A Amp', min: 0,  max: 10, step: 0.2  },
      { key: 'membraneDeformBSpeed', label: 'Deform B Spd', min: 0,  max: 2,  step: 0.05 },
      { key: 'membraneDeformBAmp',   label: 'Deform B Amp', min: 0,  max: 10, step: 0.2  },
    ],
  },
  {
    title: 'Particles',
    sliders: [
      { key: 'particleCount',   label: 'Particles', min: 0,   max: 300, step: 5   },
      { key: 'particleSpreadX', label: 'Spread X',  min: 0.5, max: 8.0, step: 0.1 },
    ],
  },
]

// All tuning keys for copy-parameters
const allTuningKeys = Object.keys(TUNING_DEFAULTS) as TuningKey[]

function formatValue(v: number): string {
  if (Number.isInteger(v)) return String(v)
  return v.toFixed(v < 1 ? 3 : 2)
}

export function GooTuningPanel() {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const store = useTuningStore()

  if (IS_MOBILE) return null

  const toggle = (title: string) =>
    setCollapsed((prev) => ({ ...prev, [title]: !prev[title] }))

  return (
    <div
      style={{
        position: 'fixed',
        left: 0,
        top: '50%',
        transform: 'translateY(-50%)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        pointerEvents: 'none',
      }}
    >
      {/* Panel body */}
      {open && (
        <div
          style={{
            width: 280,
            background: 'rgba(10, 10, 14, 0.88)',
            backdropFilter: 'blur(12px)',
            color: '#e0e0e0',
            padding: '14px 16px 10px',
            borderRadius: '0 12px 12px 0',
            fontFamily: "'JetBrains Mono', 'SF Mono', monospace",
            fontSize: 11,
            pointerEvents: 'auto',
            maxHeight: '80vh',
            borderRight: '1px solid rgba(255,255,255,0.06)',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Sections */}
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            {sections.map((section) => {
              const isCollapsed = !!collapsed[section.title]
              return (
                <div key={section.title} style={{ marginBottom: 6 }}>
                  <button
                    onClick={() => toggle(section.title)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      width: '100%',
                      background: 'none',
                      border: 'none',
                      color: '#e0e0e0',
                      cursor: 'pointer',
                      padding: '4px 0',
                      fontFamily: 'inherit',
                      fontSize: 12,
                      fontWeight: 700,
                      letterSpacing: 0.8,
                      opacity: 0.7,
                    }}
                  >
                    <span
                      style={{
                        display: 'inline-block',
                        fontSize: 8,
                        transition: 'transform 150ms',
                        transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                      }}
                    >
                      &#9660;
                    </span>
                    {section.title}
                  </button>

                  {!isCollapsed &&
                    section.sliders.map((s) => {
                      const current = store[s.key] as number
                      const dflt = TUNING_DEFAULTS[s.key]
                      const isDefault = current === dflt
                      return (
                      <div key={s.key} style={{ marginBottom: 8 }}>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: 2,
                            opacity: 0.6,
                          }}
                        >
                          <span>{s.label}</span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                              {formatValue(current)}
                            </span>
                            {!isDefault && (
                              <button
                                onClick={() => store.set(s.key, dflt)}
                                title={`Reset to ${formatValue(dflt)}`}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  padding: 0,
                                  margin: 0,
                                  cursor: 'pointer',
                                  fontSize: 14,
                                  lineHeight: 1,
                                  color: '#888',
                                  transition: 'color 150ms',
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.color = '#ff6b6b')}
                                onMouseLeave={(e) => (e.currentTarget.style.color = '#888')}
                              >
                                ↺
                              </button>
                            )}
                          </span>
                        </div>
                        <input
                          type="range"
                          min={s.min}
                          max={s.max}
                          step={s.step}
                          value={store[s.key] as number}
                          onChange={(e) => store.set(s.key, parseFloat(e.target.value))}
                          style={{
                            width: '100%',
                            height: 4,
                            cursor: 'pointer',
                            accentColor: '#a08070',
                          }}
                        />
                      </div>
                      )
                    })}
                </div>
              )
            })}
          </div>

          {/* Action buttons — always visible */}
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexShrink: 0 }}>
            <button
              onClick={async () => {
                try {
                  const params: Record<string, number> = {}
                  for (const k of allTuningKeys) params[k] = store[k] as number
                  await navigator.clipboard.writeText(JSON.stringify(params, null, 2))
                  setCopied(true)
                  setTimeout(() => setCopied(false), 2000)
                } catch {
                  // Fallback: prompt user with text
                  const params: Record<string, number> = {}
                  for (const k of allTuningKeys) params[k] = store[k] as number
                  window.prompt('Copy parameters:', JSON.stringify(params))
                }
              }}
              style={{
                flex: 1,
                padding: '6px 0',
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 6,
                color: copied ? '#8ecf8e' : '#c0b8b0',
                cursor: 'pointer',
                fontSize: 10,
                fontFamily: 'inherit',
                letterSpacing: 0.5,
              }}
            >
              {copied ? 'Copied!' : 'Copy Parameters'}
            </button>
            <button
              onClick={() => store.reset()}
              style={{
                flex: 1,
                padding: '6px 0',
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 6,
                color: '#c0b8b0',
                cursor: 'pointer',
                fontSize: 10,
                fontFamily: 'inherit',
                letterSpacing: 0.5,
              }}
            >
              Reset Defaults
            </button>
          </div>
        </div>
      )}

      {/* Toggle tab */}
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: 24,
          height: 48,
          background: 'rgba(10, 10, 14, 0.82)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderLeft: open ? 'none' : undefined,
          borderRadius: open ? '0 6px 6px 0' : '0 6px 6px 0',
          color: 'rgba(255,255,255,0.5)',
          cursor: 'pointer',
          fontSize: 11,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'auto',
          padding: 0,
          flexShrink: 0,
        }}
        title={open ? 'Collapse tuning panel' : 'Open tuning panel'}
      >
        {open ? '\u25C0' : '\u25B6'}
      </button>
    </div>
  )
}
