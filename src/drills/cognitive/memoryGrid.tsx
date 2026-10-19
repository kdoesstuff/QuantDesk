import { useCallback, useEffect, useRef, useState } from 'react'
import type { Attempt, EventLog } from '../../lib/types'
import { shuffle } from '../../lib/random'
import { Seg, Setting } from '../shared/Frames'
import { RunFrame } from '../shared/Frames'
import { useEscape } from '../shared/hooks'
import type { CognitiveSpec, Finished } from './spec'

/**
 * Visual span. A set of cells lights up, goes dark, and you rebuild it.
 * Every pass adds a cell. Three lives. The score is the largest set you
 * rebuilt. Trials log how long the rebuild took and where it went wrong,
 * so the analysis can tell a capacity limit from a rushed click.
 */
export interface MemoryConfig {
  start: 3 | 4 | 5 | 6
  flashMs: 700 | 1000 | 1400
  lives: 1 | 3 | 5
}

function gridFor(cells: number) {
  return cells <= 4 ? 3 : cells <= 7 ? 4 : cells <= 11 ? 5 : cells <= 16 ? 6 : 7
}

type Phase = 'countdown' | 'show' | 'recall' | 'reveal'

function Run({ cfg, onDone, onQuit }: { cfg: MemoryConfig; onDone: (f: Finished) => void; onQuit: () => void }) {
  const [cells, setCells] = useState<number>(cfg.start as number)
  const [lives, setLives] = useState<number>(cfg.lives as number)
  const [phase, setPhase] = useState<Phase>('countdown')
  const [count, setCount] = useState(3)
  const [pattern, setPattern] = useState<number[]>([])
  const [found, setFound] = useState<Set<number>>(new Set())
  const [wrong, setWrong] = useState<Set<number>>(new Set())
  const [best, setBest] = useState(0)
  const logs = useRef<EventLog[]>([])
  const startAt = useRef(performance.now())
  const recallAt = useRef(0)
  const errors = useRef(0)
  const trial = useRef(0)
  const livesRef = useRef(cfg.lives)
  const bestRef = useRef(0)
  const cellsRef = useRef<number>(cfg.start)
  cellsRef.current = cells

  useEscape(onQuit)

  const g = gridFor(cells)

  const startTrial = useCallback((n: number) => {
    const size = gridFor(n)
    const p = shuffle(Array.from({ length: size * size }, (_, i) => i)).slice(0, n)
    setPattern(p)
    setFound(new Set())
    setWrong(new Set())
    errors.current = 0
    trial.current += 1
    setPhase('show')
  }, [])

  // Countdown
  useEffect(() => {
    if (phase !== 'countdown') return
    if (count === 0) {
      startAt.current = performance.now()
      startTrial(cfg.start)
      return
    }
    const t = setTimeout(() => setCount((c) => c - 1), 650)
    return () => clearTimeout(t)
  }, [phase, count, cfg.start, startTrial])

  // Show the pattern, then recall
  useEffect(() => {
    if (phase !== 'show') return
    const t = setTimeout(() => {
      setPhase('recall')
      recallAt.current = performance.now()
    }, cfg.flashMs)
    return () => clearTimeout(t)
  }, [phase, cfg.flashMs])

  const finish = useCallback(() => {
    const correct = logs.current.filter((l) => l.correct).length
    onDone({
      logs: logs.current,
      score: bestRef.current,
      correct,
      wrong: logs.current.length - correct,
      durationSec: Math.round((performance.now() - startAt.current) / 1000),
      meta: { best: bestRef.current, trials: logs.current.length },
    })
  }, [onDone])

  const endTrial = (ok: boolean) => {
    const n = cellsRef.current
    const ms = performance.now() - recallAt.current
    logs.current.push({
      kind: ok ? 'pass' : 'fail',
      prompt: `${n} cells on ${gridFor(n)}x${gridFor(n)}`,
      answer: String(n),
      given: ok ? 'rebuilt' : `${errors.current} wrong`,
      ms,
      misses: errors.current,
      correct: ok,
      tags: { cells: n, grid: gridFor(n), errors: errors.current, msPerCell: Math.round(ms / n), trial: trial.current },
    })
    if (ok) {
      bestRef.current = Math.max(bestRef.current, n)
      setBest(bestRef.current)
    }
    setPhase('reveal')
    setTimeout(() => {
      if (ok) {
        setCells(n + 1)
        startTrial(n + 1)
      } else {
        livesRef.current -= 1
        setLives(livesRef.current)
        if (livesRef.current <= 0) finish()
        else startTrial(n)
      }
    }, 900)
  }

  const click = (i: number) => {
    if (phase !== 'recall') return
    if (found.has(i) || wrong.has(i)) return
    if (pattern.includes(i)) {
      const f = new Set(found)
      f.add(i)
      setFound(f)
      if (f.size === pattern.length) endTrial(true)
    } else {
      errors.current += 1
      const w = new Set(wrong)
      w.add(i)
      setWrong(w)
      // One wrong click ends the trial, as in the standard test.
      endTrial(false)
    }
  }

  const pct = (lives / cfg.lives) * 100
  return (
    <RunFrame
      pct={pct}
      left={
        <>
          {cells} cells
          <span className="run__sep">
            {lives} {lives === 1 ? 'life' : 'lives'}
          </span>
        </>
      }
      right={best}
      countdown={phase === 'countdown' ? count : null}
      hint="Click the cells that lit up. Esc to stop"
    >
      <div
        className={`mgrid mgrid--${g} is-${phase}`}
        style={{ gridTemplateColumns: `repeat(${g}, 1fr)` }}
        role="grid"
        aria-label={`${g} by ${g} grid`}
      >
        {Array.from({ length: g * g }, (_, i) => {
          const lit = phase === 'show' && pattern.includes(i)
          const isFound = found.has(i)
          const isWrong = wrong.has(i)
          const missed = phase === 'reveal' && pattern.includes(i) && !isFound
          return (
            <button
              key={i}
              className={
                'mgrid__cell' +
                (lit ? ' is-lit' : '') +
                (isFound ? ' is-found' : '') +
                (isWrong ? ' is-wrong' : '') +
                (missed ? ' is-missed' : '')
              }
              onClick={() => click(i)}
              aria-label={`cell ${i + 1}`}
              disabled={phase !== 'recall'}
            />
          )
        })}
      </div>
    </RunFrame>
  )
}

function Summary({ attempt }: { attempt: Attempt<MemoryConfig> }) {
  const passes = attempt.answers.filter((l) => l.correct)
  if (passes.length === 0) return null
  const slowest = passes.reduce((m, l) => Math.max(m, Number(l.tags?.msPerCell ?? 0)), 0)
  const fails = attempt.answers.filter((l) => !l.correct)
  const failAt = fails.map((l) => Number(l.tags?.cells))
  return (
    <section className="result__section">
      <h2>Span</h2>
      <p className="muted">
        Rebuilt up to {attempt.score} cells. Slowest pass took {(slowest / 1000).toFixed(2)}s a cell.
        {failAt.length ? ` Failed at ${failAt.join(', ')} cells.` : ' No failures.'}
      </p>
    </section>
  )
}

function Settings({ cfg, setCfg }: { cfg: MemoryConfig; setCfg: (f: (c: MemoryConfig) => MemoryConfig) => void }) {
  return (
    <>
      <Setting title="Start at">
        <Seg
          options={[3, 4, 5, 6] as const}
          value={cfg.start}
          onChange={(s) => setCfg((c) => ({ ...c, start: s }))}
          label="Start"
          format={(s) => `${s} cells`}
        />
      </Setting>
      <Setting title="Shown for">
        <Seg
          options={[700, 1000, 1400] as const}
          value={cfg.flashMs}
          onChange={(f) => setCfg((c) => ({ ...c, flashMs: f }))}
          label="Flash"
          format={(f) => `${f / 1000}s`}
        />
      </Setting>
      <Setting title="Lives" note="A wrong cell ends the trial. Lose all lives and the run ends.">
        <Seg options={[1, 3, 5] as const} value={cfg.lives} onChange={(l) => setCfg((c) => ({ ...c, lives: l }))} label="Lives" />
      </Setting>
    </>
  )
}

export const memoryGridSpec: CognitiveSpec<MemoryConfig> = {
  id: 'memory-grid',
  title: 'Memory grid',
  blurb: 'Cells flash, then you rebuild the pattern. Every pass adds a cell. The score is the largest set you rebuilt.',
  defaults: { start: 3, flashMs: 1000, lives: 3 },
  configKey: (c) => `mg:s${c.start}:f${c.flashMs}:l${c.lives}`,
  describe: (c) => `from ${c.start} cells, ${c.flashMs / 1000}s flash, ${c.lives} ${c.lives === 1 ? 'life' : 'lives'}`,
  Settings,
  Run,
  Summary,
  pointsLabel: 'the largest number of cells rebuilt',
  pace: true,
  paceLabel: 'Seconds to rebuild each pattern, in order. Blue is a pass, red a fail.',
  breakdowns: [
    {
      title: 'By pattern size',
      key: (e) => {
        const n = Number(e.tags?.cells ?? 0)
        return n <= 5 ? '3 to 5 cells' : n <= 8 ? '6 to 8 cells' : n <= 11 ? '9 to 11 cells' : '12 and up'
      },
      order: ['3 to 5 cells', '6 to 8 cells', '9 to 11 cells', '12 and up'],
    },
  ],
}
