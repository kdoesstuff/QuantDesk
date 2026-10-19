import { useEffect, useMemo, useState } from 'react'
import type { Attempt, DrillId } from '../lib/types'
import { store } from '../lib/storage'
import { readRawDrillConfig } from '../lib/config'
import { analyze, INSIGHTS_AFTER, type Finding } from './analyze'
import { activeFocus, listFocus, matchesPatch, progress, startFocus, stopFocus, type FocusBlock, type FocusProgress } from './focus'
import { recommend } from './recommend'
import { pct, secs } from './stats'
import './insights.css'

/**
 * On a drill's settings page. With a block active it shows progress and
 * keeps the settings honest; without one it offers the strongest weak
 * category as a block to start.
 */
export default function FocusCard({ drill, onApply }: { drill: DrillId; onApply: (config: object) => void }) {
  const [history, setHistory] = useState<Attempt[] | null>(null)
  const [block, setBlock] = useState<FocusBlock | null>(() => activeFocus(drill))
  const [tick, setTick] = useState(0)
  const [cfgMatches, setCfgMatches] = useState(true)

  useEffect(() => {
    store.listAttempts({ drill }).then(setHistory)
  }, [drill, tick])

  // Re-check whether the stored settings honour the block whenever it changes.
  useEffect(() => {
    if (!block) return
    const check = () => setCfgMatches(matchesPatch(readRawDrillConfig(drill), block.patch))
    check()
    const t = setInterval(check, 800)
    return () => clearInterval(t)
  }, [block, drill])

  const prog: FocusProgress | null = useMemo(() => (block && history ? progress(block, history) : null), [block, history])
  const suggestion: Finding | null = useMemo(() => {
    if (!history || block) return null
    const a = analyze(drill, history)
    return a.findings.find((f) => f.focusable && recommend(f)?.patch) ?? null
  }, [history, drill, block])
  const cleared = useMemo(
    () =>
      listFocus()
        .filter((b) => b.drill === drill && b.status === 'cleared' && (b.clearedAt ?? 0) > Date.now() - 48 * 3600 * 1000)
        .slice(-1)[0],
    [drill, tick],
  )

  if (!history) return null

  const apply = (b: FocusBlock) => {
    onApply(b.patch)
    setCfgMatches(true)
  }

  if (block && prog) {
    const isSpeed = block.kind === 'slow'
    const fmt = (x: number) => (isSpeed ? secs(x) : pct(x))
    return (
      <aside className="standing focus-card">
        <h3>Focus block</h3>
        <p className="focus-card__label">{block.label}</p>
        <p className="muted">{block.advice}</p>
        <p className="muted tnum">
          {block.baseline.medMs !== undefined && isSpeed
            ? `Baseline ${secs(block.baseline.medMs)}, target ${secs(block.target.medMs!)}.`
            : block.baseline.acc !== undefined
              ? `Baseline ${pct(block.baseline.acc)}, target ${pct(block.target.acc!)}.`
              : ''}
        </p>
        <p className="muted tnum">
          {block.runIds.length} {block.runIds.length === 1 ? 'run' : 'runs'} so far.{' '}
          {prog.current !== null
            ? `Last three: ${fmt(prog.current)}.`
            : block.runIds.length < 3
              ? `${3 - block.runIds.length} more before the target is checked.`
              : 'Not enough problems in the window yet.'}
        </p>
        {!cfgMatches && <p className="focus-card__warn">Settings differ from the block, so runs will not count.</p>}
        <div className="focus-card__actions">
          {!cfgMatches && (
            <button className="btn btn-yellow btn-small" onClick={() => apply(block)}>
              Use block settings
            </button>
          )}
          <button
            className="btn btn-ghost btn-small"
            onClick={() => {
              stopFocus(block.id)
              if (block.prevConfig) onApply(block.prevConfig)
              setBlock(null)
              setTick((t) => t + 1)
            }}
          >
            Stop block
          </button>
        </div>
      </aside>
    )
  }

  if (suggestion) {
    const rec = recommend(suggestion)!
    return (
      <aside className="standing focus-card">
        <h3>Suggested focus</h3>
        <p className="focus-card__label">{suggestion.headline}</p>
        <p className="muted">{suggestion.detail}</p>
        <div className="focus-card__actions">
          <button
            className="btn btn-yellow btn-small"
            onClick={() => {
              const b = startFocus(suggestion, readRawDrillConfig(drill))
              if (!b) return
              onApply(b.patch)
              setBlock(b)
            }}
          >
            Start block
          </button>
          <span className="faint">{rec.advice}</span>
        </div>
      </aside>
    )
  }

  if (cleared) {
    const isSpeed = cleared.kind === 'slow'
    return (
      <aside className="standing focus-card is-cleared">
        <h3>Cleared</h3>
        <p className="focus-card__label">{cleared.label}</p>
        <p className="muted">
          {isSpeed && cleared.baseline.medMs
            ? `From ${secs(cleared.baseline.medMs)} to under ${secs(cleared.target.medMs!)}.`
            : cleared.baseline.acc !== undefined
              ? `From ${pct(cleared.baseline.acc)} to over ${pct(cleared.target.acc!)}.`
              : ''}{' '}
          Back to mixed practice.
        </p>
        {cleared.prevConfig && !matchesPatch(readRawDrillConfig(drill), cleared.prevConfig) && (
          <div className="focus-card__actions">
            <button className="btn btn-yellow btn-small" onClick={() => onApply(cleared.prevConfig!)}>
              Restore previous settings
            </button>
          </div>
        )}
      </aside>
    )
  }
  // Nothing to show yet: say what it takes, in plain numbers.
  const events = history.reduce((n, a) => n + a.answers.filter((l) => l.given !== null).length, 0)
  const perRun = history.length ? Math.max(1, Math.round(events / history.length)) : (EVENTS_PER_RUN[drill] ?? 40)
  const runsLeft = Math.max(0, Math.ceil((INSIGHTS_AFTER - events) / perRun))
  return (
    <aside className="standing insights-note">
      <h3>Insights</h3>
      {events < INSIGHTS_AFTER ? (
        <>
          <p className="faint">
            Play about {runsLeft} {runsLeft === 1 ? 'more run' : 'more runs'} to start getting insights into your weak spots
            {events > 0 ? ` (${events} of ${INSIGHTS_AFTER} problems so far)` : ''}.
          </p>
          <p className="faint">After that a focus mode appears here, with settings built to improve.</p>
        </>
      ) : (
        <>
          <p className="faint">
            Insights are on: {history.length} runs, {events} problems. No weak spot stands out yet; a focus mode appears here as soon as one
            does.
          </p>
        </>
      )}
    </aside>
  )
}

/** Rough problems per run at default settings, used before there is history. */
const EVENTS_PER_RUN: Partial<Record<DrillId, number>> = {
  'speed-arithmetic': 50,
  'eighty-in-eight': 80,
  sequences: 25,
  fractions: 35,
  percentages: 30,
  'dice-market': 20,
  'cards-market': 20,
  'make-a-market': 10,
  'betting-board': 10,
  kelly: 30,
  'etf-arb': 25,
  'event-contracts': 20,
  fermi: 10,
  'memory-grid': 10,
  'task-switch': 96,
  intercept: 20,
  balloon: 30,
}
