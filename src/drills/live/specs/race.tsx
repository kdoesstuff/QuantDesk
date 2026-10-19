import { chance } from '../../../lib/random'
import { Seg, Setting } from '../../shared/Frames'
import type { LiveConfig, LiveSpec } from '../spec'

/**
 * The race. Two runners advance one step at a time; the contract pays if
 * A reaches the finish first. The exact probability at every moment is a
 * classic problem of points, so every quote can be scored against truth.
 */
export interface RaceConfig extends LiveConfig {
  length: 6 | 10 | 15
  /** Chance that any given step goes to A. Shown to the player. */
  pA: 0.5 | 0.55 | 0.6
}

export interface RaceState {
  a: number
  b: number
}

const memo = new Map<string, number>()
/** Probability A wins needing i steps when B needs j, with A taking each step with probability p. */
function pWin(i: number, j: number, p: number): number {
  if (i <= 0) return 1
  if (j <= 0) return 0
  const k = `${i},${j},${p}`
  const m = memo.get(k)
  if (m !== undefined) return m
  const v = p * pWin(i - 1, j, p) + (1 - p) * pWin(i, j - 1, p)
  memo.set(k, v)
  return v
}

function Track({ label, steps, length, tone }: { label: string; steps: number; length: number; tone: 'a' | 'b' }) {
  return (
    <div className={`race__track race__track--${tone}`}>
      <span className="race__label">{label}</span>
      <div className="race__lane">
        {Array.from({ length }, (_, i) => (
          <span key={i} className={'race__cell' + (i < steps ? ' is-on' : '')} />
        ))}
      </div>
      <span className="race__count tnum">
        {steps}/{length}
      </span>
    </div>
  )
}

function View({ state, cfg }: { state: RaceState; cfg: RaceConfig }) {
  return (
    <div className="race">
      <Track label="A" steps={state.a} length={cfg.length} tone="a" />
      <Track label="B" steps={state.b} length={cfg.length} tone="b" />
    </div>
  )
}

function Settings({ cfg, setCfg }: { cfg: RaceConfig; setCfg: (f: (c: RaceConfig) => RaceConfig) => void }) {
  return (
    <>
      <Setting title="Rounds">
        <Seg options={[5, 10, 20] as const} value={cfg.rounds} onChange={(r) => setCfg((c) => ({ ...c, rounds: r }))} label="Rounds" />
      </Setting>
      <Setting title="Race length" note="Steps to the finish. Longer races give more time to see the market go wrong.">
        <Seg options={[6, 10, 15] as const} value={cfg.length} onChange={(l) => setCfg((c) => ({ ...c, length: l }))} label="Length" />
      </Setting>
      <Setting title="A's step chance" note="The chance each step goes to A rather than B. Shown during the race.">
        <Seg options={[0.5, 0.55, 0.6] as const} value={cfg.pA} onChange={(p) => setCfg((c) => ({ ...c, pA: p }))} label="Step chance" format={(p) => `${Math.round(p * 100)}%`} />
      </Setting>
      <Setting title="Market" note="Lagging markets move toward fair slowly. Jumpy markets overshoot it. Mixed picks one each round, and sometimes the market is simply right.">
        <Seg options={['lag', 'jumpy', 'mixed'] as const} value={cfg.bot} onChange={(b) => setCfg((c) => ({ ...c, bot: b }))} label="Market" format={(b) => (b === 'lag' ? 'Lagging' : b === 'jumpy' ? 'Jumpy' : 'Mixed')} />
      </Setting>
      <Setting title="Speed">
        <Seg options={[700, 450, 300] as const} value={cfg.tickMs} onChange={(t) => setCfg((c) => ({ ...c, tickMs: t }))} label="Speed" format={(t) => (t === 700 ? 'Slow' : t === 450 ? 'Medium' : 'Fast')} />
      </Setting>
      <Setting title="Spread">
        <Seg options={[1, 2, 3] as const} value={cfg.half} onChange={(h) => setCfg((c) => ({ ...c, half: h }))} label="Spread" format={(h) => `${h * 2}c wide`} />
      </Setting>
    </>
  )
}

export const raceSpec: LiveSpec<RaceConfig, RaceState> = {
  id: 'race',
  title: 'The race',
  blurb: 'Two runners, one step at a time. A contract pays 100 if A finishes first. The market quotes it live and is sometimes slow, sometimes jumpy. Trade the gap.',
  defaults: { rounds: 10, tickMs: 450, bot: 'mixed', half: 2, length: 10, pA: 0.5 },
  configKey: (c) => `race:r${c.rounds}:n${c.length}:p${c.pA}:${c.bot}:t${c.tickMs}:s${c.half}`,
  describe: (c) => `${c.rounds} races to ${c.length}, A ${Math.round(c.pA * 100)}% a step, ${c.bot} market`,
  Settings,
  process: {
    init: () => ({ a: 0, b: 0 }),
    step: (s, cfg) => (chance(cfg.pA) ? { ...s, a: s.a + 1 } : { ...s, b: s.b + 1 }),
    done: (s, cfg) => s.a >= cfg.length || s.b >= cfg.length,
    trueP: (s, cfg) => pWin(cfg.length - s.a, cfg.length - s.b, cfg.pA),
    outcome: (s, cfg) => (s.a >= cfg.length ? 1 : 0),
    describe: (s) => `A ${s.a}, B ${s.b}`,
    contract: (cfg) => `Pays 100 if A reaches ${cfg.length} first. Each step goes to A with ${Math.round(cfg.pA * 100)}% chance.`,
    View,
  },
  breakdowns: [
    { title: 'By market', key: (e) => (e.tags?.bot === 'lag' ? 'Lagging' : e.tags?.bot === 'jumpy' ? 'Jumpy' : 'Efficient'), order: ['Lagging', 'Jumpy', 'Efficient'] },
    { title: 'By what you did', key: (e) => (e.tags?.side === 'buy' ? 'Bought' : e.tags?.side === 'sell' ? 'Sold' : e.tags?.missed ? 'Passed, edge on offer' : 'Passed, nothing there'), order: ['Bought', 'Sold', 'Passed, edge on offer', 'Passed, nothing there'] },
    { title: 'By when you entered', key: (e) => (e.tags?.entry === 'none' ? null : e.tags?.entry === 'early' ? 'Early in the race' : e.tags?.entry === 'middle' ? 'Mid race' : 'Late in the race'), order: ['Early in the race', 'Mid race', 'Late in the race'] },
  ],
}
