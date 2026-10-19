import { pick, round } from '../../../lib/random'
import { Chips, Seg, Setting, toggleIn } from '../../shared/Frames'
import { QuoteInput } from '../controls'
import type { Outcome, RoundsSpec, Scenario } from '../spec'
import { ALL_CATEGORIES, CATEGORY_LABEL, FACTS, type Fact, type FactCategory } from './facts'

/**
 * Make me a market: a two-sided quote on a number you half know. The score
 * rewards a quote that contains the truth and is tight. A market three
 * times as wide as it is low scores nothing even when it contains the
 * truth; missing the truth costs 50.
 */
export interface MakeConfig {
  rounds: 10 | 20
  perRoundSec: 0 | 20 | 10
  categories: FactCategory[]
}

export interface MakeScenario extends Scenario {
  fact: Fact
}
export type MakeDecision = { bid: number; ask: number }

const SPREAD_FOR_ZERO = 3 // a quote this many times wide scores zero

function next(c: MakeConfig, prev?: MakeScenario): MakeScenario {
  const cats = c.categories.length ? c.categories : ALL_CATEGORIES
  const pool = FACTS.filter((f) => cats.includes(f.cat) && f !== prev?.fact)
  const fact = pick(pool)
  return { kind: fact.cat, prompt: fact.q, tags: { category: fact.cat, magnitude: Math.floor(Math.log10(fact.v)) }, fact }
}

function fmt(x: number) {
  return x >= 1000 ? Math.round(x).toLocaleString('en-US') : String(round(x, 2))
}

function resolve(s: MakeScenario, d: MakeDecision | null): Outcome {
  const T = s.fact.v
  const noteTruth = `${s.fact.q}: ${fmt(T)}${s.fact.note ? ` (${s.fact.note})` : ''}.`
  if (!d || d.bid <= 0 || d.ask <= 0 || d.ask < d.bid) {
    return { points: -50, correct: false, given: d ? `${fmt(d.bid)} at ${fmt(d.ask)}` : 'timed out', answer: fmt(T), note: noteTruth, tags: { contained: false, widthRatio: 0, logErr: 0 } }
  }
  const contained = d.bid <= T && T <= d.ask
  const widthRatio = d.ask / d.bid
  const mid = Math.sqrt(d.bid * d.ask)
  const logErr = round(Math.log10(mid / T), 3)
  let points: number
  if (contained) points = Math.max(0, Math.round(100 * (1 - Math.log(widthRatio) / Math.log(SPREAD_FOR_ZERO))))
  else points = -50
  const tightness = widthRatio < 1.25 ? 'tight' : widthRatio < 2 ? 'medium' : 'wide'
  return {
    points,
    correct: contained,
    given: `${fmt(d.bid)} at ${fmt(d.ask)}`,
    answer: fmt(T),
    note: contained ? `Inside, ${round(widthRatio, 2)}x wide. ${noteTruth}` : `${T < d.bid ? 'Hit, too high' : 'Lifted, too low'}. ${noteTruth}`,
    tags: { contained, widthRatio: round(widthRatio, 2), logErr, lean: logErr > 0.05 ? 'high' : logErr < -0.05 ? 'low' : 'centred', tightness },
  }
}

function Scene({ scenario }: { scenario: MakeScenario }) {
  return (
    <div className="market">
      <p className="market__question">{scenario.fact.q}</p>
      {scenario.fact.unit ? <p className="muted">{scenario.fact.unit}</p> : null}
    </div>
  )
}

function Decide({ onDecide, disabled }: { scenario: MakeScenario; cfg: MakeConfig; onDecide: (d: MakeDecision) => void; disabled: boolean }) {
  return <QuoteInput onSubmit={(bid, ask) => onDecide({ bid, ask })} disabled={disabled} step={0.01} />
}

function Settings({ cfg, setCfg }: { cfg: MakeConfig; setCfg: (f: (c: MakeConfig) => MakeConfig) => void }) {
  return (
    <>
      <Setting title="Rounds">
        <Seg options={[10, 20] as const} value={cfg.rounds} onChange={(r) => setCfg((c) => ({ ...c, rounds: r }))} label="Rounds" />
      </Setting>
      <Setting title="Time per quote">
        <Seg options={[0, 20, 10] as const} value={cfg.perRoundSec} onChange={(t) => setCfg((c) => ({ ...c, perRoundSec: t }))} label="Time per quote" format={(t) => (t === 0 ? 'No limit' : `${t}s`)} />
      </Setting>
      <Setting title="Topics" note="A quote that contains the truth scores 100 minus a penalty for width; three times wide scores zero. Missing the truth costs 50.">
        <Chips options={ALL_CATEGORIES} value={cfg.categories} onToggle={(k) => setCfg((c) => ({ ...c, categories: toggleIn(c.categories, k) }))} labels={CATEGORY_LABEL} />
      </Setting>
    </>
  )
}

export const makeMarketSpec: RoundsSpec<MakeConfig, MakeScenario, MakeDecision> = {
  id: 'make-a-market',
  title: 'Make me a market',
  blurb: 'A two-sided quote on a number you half know. Tight and right scores high, wide scores little, wrong costs you. The interview classic.',
  defaults: { rounds: 10, perRoundSec: 0, categories: [...ALL_CATEGORIES] },
  configKey: (c) => `mm:r${c.rounds}:t${c.perRoundSec}:${ALL_CATEGORIES.filter((k) => c.categories.includes(k)).join(',')}`,
  describe: (c) => `${c.rounds} quotes${c.perRoundSec ? `, ${c.perRoundSec}s each` : ''}${c.categories.length === ALL_CATEGORIES.length ? '' : `, ${c.categories.length} topics`}`,
  Settings,
  rounds: (c) => c.rounds,
  perRoundSec: (c) => c.perRoundSec,
  next,
  Scene,
  Decide,
  resolve,
  pointsLabel: 'calibration points, 100 a quote at most',
  places: 0,
  unit: ' pts',
  hint: 'Type bid, Tab, ask, Enter. Esc to stop',
  breakdowns: [
    { title: 'By topic', key: (e) => CATEGORY_LABEL[(e.tags?.category as FactCategory) ?? 'maths'] ?? null, order: ALL_CATEGORIES.map((k) => CATEGORY_LABEL[k]) },
    { title: 'By width', key: (e) => (e.given === null ? null : e.tags?.tightness === 'tight' ? 'Tight (under 1.25x)' : e.tags?.tightness === 'medium' ? 'Medium (1.25x to 2x)' : 'Wide (over 2x)'), order: ['Tight (under 1.25x)', 'Medium (1.25x to 2x)', 'Wide (over 2x)'] },
    { title: 'By lean', key: (e) => (e.given === null ? null : e.tags?.lean === 'high' ? 'Quoted high' : e.tags?.lean === 'low' ? 'Quoted low' : 'Centred'), order: ['Quoted low', 'Centred', 'Quoted high'] },
  ],
}
