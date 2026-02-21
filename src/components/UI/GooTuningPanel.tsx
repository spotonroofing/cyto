import { useState } from 'react'
import { useTuningStore, type TuningState } from '@/stores/tuningStore'
import { IS_MOBILE } from '@/utils/performanceTier'

type TuningKey = keyof Omit<TuningState, 'set'>

interface SliderDef {
  key: TuningKey
  label: string
  min: number
  max: number
  step: number
}

const sliders: SliderDef[] = [
  { key: 'tubeWidthRatio',         label: 'Bridge Width',   min: 0.05, max: 0.60, step: 0.01 },
  { key: 'filletWidthRatio',       label: 'Fillet Ratio',   min: 0.5,  max: 3.0,  step: 0.1  },
  { key: 'blurStdDev',             label: 'Goo Halo',       min: 0,    max: 30,   step: 1    },
  { key: 'nucleusRatioCanvas',     label: 'Nucleus Canvas', min: 0.3,  max: 1.0,  step: 0.01 },
  { key: 'nucleusRatioSvg',        label: 'Nucleus SVG',    min: 0.3,  max: 1.0,  step: 0.01 },
  { key: 'iconSizeRatio',          label: 'Icon Size',      min: 0.1,  max: 0.5,  step: 0.01 },
  { key: 'phaseNameFontSize',      label: 'Name Size',      min: 6,    max: 24,   step: 1    },
  { key: 'phaseIndicatorFontSize', label: 'P# Size',        min: 4,    max: 18,   step: 1    },
  { key: 'particleCount',          label: 'Particles',      min: 0,    max: 300,  step: 5    },
  { key: 'particleSpreadX',        label: 'Spread X',       min: 0.5,  max: 8.0,  step: 0.1  },
]

function formatValue(v: number): string {
  if (Number.isInteger(v)) return String(v)
  return v.toFixed(v < 1 ? 3 : 2)
}

export function GooTuningPanel() {
  const [open, setOpen] = useState(false)
  const store = useTuningStore()

  if (IS_MOBILE) return null

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
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 12,
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1, opacity: 0.7 }}>
              Goo
            </span>
          </div>

          {sliders.map((s) => (
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
