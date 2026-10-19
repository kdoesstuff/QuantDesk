import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Attempt, Operation, SpeedArithmeticConfig } from '../../lib/types'
import { store } from '../../lib/storage'
import { configKey, loadConfig, OP_LABEL, saveConfig } from './generator'
import Sparkline from '../../components/Sparkline'
import FocusCard from '../../insights/FocusCard'
import RunLog from '../shared/RunLog'
import '../shared/drill.css'

const DURATIONS: SpeedArithmeticConfig['durationSec'][] = [30, 60, 120, 300]
const OPS: Operation[] = ['add', 'sub', 'mul', 'div']

function Range({ label, min, max, onChange }: { label: string; min: number; max: number; onChange: (min: number, max: number) => void }) {
  return (
    <div className="range">
      <span>{label}</span>
      <input
        className="input tnum"
        type="number"
        inputMode="numeric"
        value={min}
        min={0}
        onChange={(e) => onChange(Number(e.target.value), max)}
        aria-label={`${label} minimum`}
      />
      <span className="range__to">to</span>
      <input
        className="input tnum"
        type="number"
        inputMode="numeric"
        value={max}
        min={0}
        onChange={(e) => onChange(min, Number(e.target.value))}
        aria-label={`${label} maximum`}
      />
    </div>
  )
}

export default function SpeedArithmeticConfigPage() {
  const nav = useNavigate()
  const [cfg, setCfg] = useState<SpeedArithmeticConfig>(loadConfig)
  const [history, setHistory] = useState<Attempt[]>([])

  const key = configKey(cfg)
  useEffect(() => {
    saveConfig(cfg)
    store.listAttempts({ drill: 'speed-arithmetic', configKey: key, limit: 30 }).then(setHistory)
  }, [cfg, key])

  const best = history.reduce((m, a) => Math.max(m, a.score), 0)
  const series = [...history].reverse().map((a) => a.score)

  const toggleOp = (op: Operation) =>
    setCfg((c) => {
      const has = c.ops.includes(op)
      if (has && c.ops.length === 1) return c
      return {
        ...c,
        ops: has ? c.ops.filter((o) => o !== op) : [...c.ops, op],
      }
    })

  const start = () => nav('/drill/speed-arithmetic/run')

  // Enter starts from anywhere on the page except inside a number field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !(e.target instanceof HTMLInputElement)) start()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const valid = cfg.addMin <= cfg.addMax && cfg.mulLeftMin <= cfg.mulLeftMax && cfg.mulRightMin <= cfg.mulRightMax

  return (
    <div className="page drill-config">
      <header className="drill-head">
        <h1 className="display">Speed arithmetic</h1>
        <p className="muted">
          One problem at a time, typed answer, no submit key. A correct answer clears itself. Score is the number right before the clock
          stops.
        </p>
      </header>

      <div className="drill-config__grid">
        <section className="settings">
          <div className="setting">
            <h3>Clock</h3>
            <div className="seg" role="group" aria-label="Duration">
              {DURATIONS.map((d) => (
                <button key={d} aria-pressed={cfg.durationSec === d} onClick={() => setCfg((c) => ({ ...c, durationSec: d }))}>
                  {d < 60 ? `${d}s` : `${d / 60} min`}
                </button>
              ))}
            </div>
          </div>

          <div className="setting">
            <h3>Operations</h3>
            <div className="chips">
              {OPS.map((op) => (
                <button key={op} className="chip" aria-pressed={cfg.ops.includes(op)} onClick={() => toggleOp(op)}>
                  {OP_LABEL[op]}
                </button>
              ))}
            </div>
            <p className="faint setting__note">
              Subtraction and division are the inverses of the ranges below, so answers stay whole and positive.
            </p>
          </div>

          <div className="setting">
            <h3>Ranges</h3>
            <Range
              label="Addends"
              min={cfg.addMin}
              max={cfg.addMax}
              onChange={(min, max) => setCfg((c) => ({ ...c, addMin: min, addMax: max }))}
            />
            <Range
              label="Small factor"
              min={cfg.mulLeftMin}
              max={cfg.mulLeftMax}
              onChange={(min, max) => setCfg((c) => ({ ...c, mulLeftMin: min, mulLeftMax: max }))}
            />
            <Range
              label="Large factor"
              min={cfg.mulRightMin}
              max={cfg.mulRightMax}
              onChange={(min, max) => setCfg((c) => ({ ...c, mulRightMin: min, mulRightMax: max }))}
            />
          </div>

          <div className="setting setting--start">
            <button className="btn btn-primary" onClick={start} disabled={!valid}>
              Start
            </button>
            <span className="faint">Enter</span>
          </div>
        </section>

        <div className="drill-config__aside">
          <FocusCard
            drill="speed-arithmetic"
            onApply={(p) =>
              setCfg((c) => ({
                ...c,
                ...(p as Partial<SpeedArithmeticConfig>),
              }))
            }
          />
          {history.length > 0 && (
            <aside className="standing">
              <h3>With these settings</h3>
              {
                <>
                  <p className="standing__best">
                    <span className="tnum">{best}</span>
                    <span className="muted">best of {history.length}</span>
                  </p>
                  {series.length > 1 && (
                    <>
                      <Sparkline values={series} height={56} />
                      <p className="faint">Last {Math.min(30, history.length)} runs, oldest to newest.</p>
                    </>
                  )}
                </>
              }
            </aside>
          )}
        </div>
      </div>
      <RunLog drill="speed-arithmetic" currentKey={key} />
    </div>
  )
}
