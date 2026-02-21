import { useState } from 'react'
import { useTuningStore, type TuningKey } from '@/stores/tuningStore'
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
      { key: 'nucleusRatioCanvas', label: 'Nucleus Canvas', min: 0.3,  max: 1.0,  step: 0.01 },
      { key: 'nucleusRatioSvg',    label: 'Nucleus SVG',    min: 0.3,  max: 1.0,  step: 0.01 },
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
    title: 'Particles',
    sliders: [
      { key: 'particleCount',   label: 'Particles', min: 0,   max: 300, step: 5   },
      { key: 'particleSpreadX', label: 'Spread X',  min: 0.5, max: 8.0, step: 0.1 },
    ],
  },
]

// Flat list for copy-parameters
const allSliders = sections.flatMap((s) => s.sliders)

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
            overflowY: 'auto',
            borderRight: '1px solid rgba(255,255,255,0.06)',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Sections */}
          <div style={{ flex: 1, minHeight: 0 }}>
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
                    section.sliders.map((s) => (
                      <div key={s.key} style={{ marginBottom: 8 }}>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            marginBottom: 2,
                            opacity: 0.6,
                          }}
                        >
                          <span>{s.label}</span>
                          <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                            {formatValue(store[s.key] as number)}
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
                    ))}
                </div>
              )
            })}
          </div>

          {/* Action buttons — always visible */}
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexShrink: 0 }}>
            <button
              onClick={() => {
                const params: Record<string, number> = {}
                for (const s of allSliders) params[s.key] = store[s.key] as number
                navigator.clipboard.writeText(JSON.stringify(params, null, 2))
                setCopied(true)
                setTimeout(() => setCopied(false), 2000)
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
