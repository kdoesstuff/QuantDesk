import { chance } from '../../../lib/random'
import { Seg, Setting } from '../../shared/Frames'
import type { LiveConfig, LiveSpec } from '../spec'

/**
 * The evidence stream. One of two coins was picked at random: a fair one,
 * or one biased to heads. Flips arrive one at a time. The contract pays
 * 100 if the coin is the biased one. The exact posterior after each flip
 * is Bayes' rule, so the market can be scored against it.
 */
export interface EvidenceConfig extends LiveConfig {
  flips: 12 | 20 | 30
  /** Heads probability of the biased coin. */
  bias: 0.6 | 0.7 | 0.8
}

export interface EvidenceState {
  biased: boolean
  flips: boolean[]
}

function posterior(s: EvidenceState, bias: number) {
  const h = s.flips.filter(Boolean).length
  const t = s.flips.length - h
  // Prior one half each. Odds of biased = (bias^h (1-bias)^t) / (0.5^(h+t)).
  const logOdds = h * Math.log(bias / 0.5) + t * Math.log((1 - bias) / 0.5)
  return 1 / (1 + Math.exp(-logOdds))
}

function View({ state, cfg }: { state: EvidenceState; cfg: EvidenceConfig }) {
  const h = state.flips.filter(Boolean).length
  return (
    <div className="evidence">
      <div className="evidence__flips">
        {Array.from({ length: cfg.flips }, (_, i) => {
          const f = state.flips[i]
          return (
            <span key={i} className={'evidence__flip' + (f === undefined ? '' : f ? ' is-h' : ' is-t')}>
              {f === undefined ? '' : f ? 'H' : 'T'}
            </span>
          )
        })}
      </div>
      <p className="muted tnum">
        {h} heads, {state.flips.length - h} tails, {cfg.flips - state.flips.length} to come
      </p>
    </div>
  )
}

function Settings({ cfg, setCfg }: { cfg: EvidenceConfig; setCfg: (f: (c: EvidenceConfig) => EvidenceConfig) => void }) {
  return (
    <>
      <Setting title="Rounds">
        <Seg options={[5, 10, 20] as const} value={cfg.rounds} onChange={(r) => setCfg((c) => ({ ...c, rounds: r }))} label="Rounds" />
      </Setting>
      <Setting title="Flips a round">
        <Seg options={[12, 20, 30] as const} value={cfg.flips} onChange={(f) => setCfg((c) => ({ ...c, flips: f }))} label="Flips" />
      </Setting>
      <Setting
        title="The biased coin"
        note="How often the biased coin lands heads. The fair coin is 50 percent. A weaker bias means the evidence builds slowly."
      >
        <Seg
          options={[0.6, 0.7, 0.8] as const}
          value={cfg.bias}
          onChange={(b) => setCfg((c) => ({ ...c, bias: b }))}
          label="Bias"
          format={(b) => `${Math.round(b * 100)}% heads`}
        />
      </Setting>
      <Setting
        title="Market"
        note="Lagging markets update too slowly on each flip. Jumpy markets overreact to a run. Mixed picks one each round, and sometimes the market is simply right."
      >
        <Seg
          options={['lag', 'jumpy', 'mixed'] as const}
          value={cfg.bot}
          onChange={(b) => setCfg((c) => ({ ...c, bot: b }))}
          label="Market"
          format={(b) => (b === 'lag' ? 'Lagging' : b === 'jumpy' ? 'Jumpy' : 'Mixed')}
        />
      </Setting>
      <Setting title="Speed">
        <Seg
          options={[700, 450, 300] as const}
          value={cfg.tickMs}
          onChange={(t) => setCfg((c) => ({ ...c, tickMs: t }))}
          label="Speed"
          format={(t) => (t === 700 ? 'Slow' : t === 450 ? 'Medium' : 'Fast')}
        />
      </Setting>
      <Setting title="Spread">
        <Seg
          options={[1, 2, 3] as const}
          value={cfg.half}
          onChange={(h) => setCfg((c) => ({ ...c, half: h }))}
          label="Spread"
          format={(h) => `${h * 2}c wide`}
        />
      </Setting>
    </>
  )
}

export const evidenceSpec: LiveSpec<EvidenceConfig, EvidenceState> = {
  id: 'evidence',
  title: 'Evidence stream',
  blurb:
    'A fair coin or a biased one, picked at random. Flips arrive one at a time and a contract on "it is the biased coin" trades live. The market updates badly. You update well.',
  defaults: { rounds: 10, tickMs: 700, bot: 'mixed', half: 2, flips: 20, bias: 0.7 },
  configKey: (c) => `ev2:r${c.rounds}:f${c.flips}:b${c.bias}:${c.bot}:t${c.tickMs}:s${c.half}`,
  describe: (c) => `${c.rounds} rounds of ${c.flips} flips, bias ${Math.round(c.bias * 100)}%, ${c.bot} market`,
  Settings,
  process: {
    init: () => ({ biased: chance(0.5), flips: [] }),
    step: (s, cfg) => ({ ...s, flips: [...s.flips, chance(s.biased ? cfg.bias : 0.5)] }),
    done: (s, cfg) => s.flips.length >= cfg.flips,
    trueP: (s, cfg) => posterior(s, cfg.bias),
    outcome: (s) => (s.biased ? 1 : 0),
    describe: (s) => `${s.flips.filter(Boolean).length}H ${s.flips.length - s.flips.filter(Boolean).length}T`,
    contract: (cfg) => `Pays 100 if this is the biased coin (${Math.round(cfg.bias * 100)}% heads). Fair coin or biased, 50/50 to start.`,
    explain: (s, cfg) => {
      const h = s.flips.filter(Boolean).length
      const t = s.flips.length - h
      const lrH = cfg.bias / 0.5
      const lrT = (1 - cfg.bias) / 0.5
      const lr = lrH ** h * lrT ** t
      const post = posterior(s, cfg.bias)
      return `${h} heads and ${t} tails so far. Each head multiplies the odds of "biased" by ${cfg.bias}/0.5 = ${lrH}, each tail by ${(1 - cfg.bias).toFixed(1)}/0.5 = ${lrT}. Starting from even odds: ${lrH}^${h} × ${lrT}^${t} = ${lr >= 100 ? Math.round(lr) : Math.round(lr * 100) / 100}, so P(biased) = ${lr >= 100 ? Math.round(lr) : Math.round(lr * 100) / 100} ÷ (1 + ${lr >= 100 ? Math.round(lr) : Math.round(lr * 100) / 100}) = ${Math.round(post * 100)}%.`
    },
    View,
  },
  breakdowns: [
    {
      title: 'By market',
      key: (e) => (e.tags?.bot === 'lag' ? 'Lagging' : e.tags?.bot === 'jumpy' ? 'Jumpy' : 'Efficient'),
      order: ['Lagging', 'Jumpy', 'Efficient'],
    },
    {
      title: 'By what you did',
      key: (e) =>
        e.tags?.side === 'buy'
          ? 'Bought'
          : e.tags?.side === 'sell'
            ? 'Sold'
            : e.tags?.missed
              ? 'Passed, edge on offer'
              : 'Passed, nothing there',
      order: ['Bought', 'Sold', 'Passed, edge on offer', 'Passed, nothing there'],
    },
    {
      title: 'By when you entered',
      key: (e) =>
        e.tags?.entry === 'none'
          ? null
          : e.tags?.entry === 'early'
            ? 'Early, few flips'
            : e.tags?.entry === 'middle'
              ? 'Mid stream'
              : 'Late, most flips in',
      order: ['Early, few flips', 'Mid stream', 'Late, most flips in'],
    },
  ],
}
