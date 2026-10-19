import { useCallback, useEffect, useRef, useState } from 'react'
import type { Attempt, EventLog } from '../../lib/types'
import { chance, pick, round } from '../../lib/random'
import { RunFrame, Seg, Setting } from '../shared/Frames'
import { useEscape } from '../shared/hooks'
import { QuoteInput } from '../rounds/controls'
import type { CognitiveSpec, Finished } from './spec'

/**
 * Make the market on an event. You quote bid and ask in cents on a YES
 * contract. Traders arrive one at a time. A share of them know the
 * outcome and trade the right way; the rest are noise with a private
 * value, so a wide quote trades less. After every fill you quote again.
 * This is the Glosten and Milgrom model, played by hand: the score is the
 * expected profit of each quote given everything the tape has told you.
 */
export interface MakerConfig {
  rounds: 5 | 10
  traders: 6 | 10
  informed: 0.2 | 0.4 | 0.6
}

interface Tape {
  action: 'buy' | 'sell' | 'none'
  bid: number
  ask: number
}

function expected(bid: number, ask: number, q: number, mu: number) {
  const buyInf = mu * q
  const buyNoise = ((1 - mu) * (100 - ask)) / 100
  const sellInf = mu * (1 - q)
  const sellNoise = ((1 - mu) * bid) / 100
  return buyInf * (ask - 100) + buyNoise * (ask - 100 * q) + sellInf * -bid + sellNoise * (100 * q - bid)
}

function optimal(q: number, mu: number) {
  let best = { bid: 1, ask: 99, e: -Infinity }
  for (let bid = 1; bid <= 98; bid++) {
    for (let ask = bid + 1; ask <= 99; ask++) {
      const e = expected(bid, ask, q, mu)
      if (e > best.e) best = { bid, ask, e }
    }
  }
  return best
}

function update(q: number, action: Tape['action'], bid: number, ask: number, mu: number) {
  if (action === 'none') return q
  const l1 = action === 'buy' ? mu + ((1 - mu) * (100 - ask)) / 100 : ((1 - mu) * bid) / 100
  const l0 = action === 'buy' ? ((1 - mu) * (100 - ask)) / 100 : mu + ((1 - mu) * bid) / 100
  return (q * l1) / (q * l1 + (1 - q) * l0)
}

function Run({ cfg, onDone, onQuit }: { cfg: MakerConfig; onDone: (f: Finished) => void; onQuit: () => void }) {
  const [phase, setPhase] = useState<'countdown' | 'quote' | 'reveal' | 'done'>('countdown')
  const [count, setCount] = useState(3)
  const [roundNo, setRoundNo] = useState(0)
  const [prior, setPrior] = useState(0.5)
  const [tape, setTape] = useState<Tape[]>([])
  const [score, setScore] = useState(0)
  const [note, setNote] = useState<string | null>(null)
  const logs = useRef<EventLog[]>([])
  const startAt = useRef(0)
  const quoteAt = useRef(0)
  const V = useRef<0 | 1>(0)
  const q = useRef(0.5)
  const realised = useRef(0)
  const scoreRef = useRef(0)
  const roundPnl = useRef(0)
  const mu = cfg.informed

  useEscape(onQuit)

  const newRound = useCallback(() => {
    const p0 = pick([0.3, 0.4, 0.5, 0.6, 0.7])
    setPrior(p0)
    q.current = p0
    V.current = chance(p0) ? 1 : 0
    roundPnl.current = 0
    setTape([])
    setNote(null)
    setPhase('quote')
    quoteAt.current = performance.now()
  }, [])

  useEffect(() => {
    if (phase !== 'countdown') return
    if (count === 0) {
      startAt.current = performance.now()
      newRound()
      return
    }
    const t = setTimeout(() => setCount((c) => c - 1), 650)
    return () => clearTimeout(t)
  }, [phase, count, newRound])

  const finish = useCallback(() => {
    setPhase('done')
    const ok = logs.current.filter((l) => l.correct).length
    onDone({
      logs: logs.current,
      score: round(scoreRef.current, 0),
      correct: ok,
      wrong: logs.current.length - ok,
      durationSec: Math.round((performance.now() - startAt.current) / 1000),
      meta: { realised: realised.current },
    })
  }, [onDone])

  const onQuote = (bidRaw: number, askRaw: number) => {
    if (phase !== 'quote') return
    const bid = Math.round(Math.max(0, Math.min(99, bidRaw)))
    const ask = Math.round(Math.max(1, Math.min(99, askRaw)))
    if (ask <= bid) return
    const qNow = q.current
    const e = expected(bid, ask, qNow, mu)
    const opt = optimal(qNow, mu)
    // The trader.
    const informed = chance(mu)
    let action: Tape['action']
    if (informed) action = V.current === 1 ? 'buy' : 'sell'
    else {
      const r = Math.random() * 100
      action = r >= ask ? 'buy' : r <= bid ? 'sell' : 'none'
    }
    const pnl = action === 'buy' ? ask - 100 * V.current : action === 'sell' ? 100 * V.current - bid : 0
    roundPnl.current += pnl
    const prev = tape[tape.length - 1]
    const mid = (bid + ask) / 2
    logs.current.push({
      kind: 'quote',
      prompt: `prior ${Math.round(prior * 100)}, trader ${tape.length + 1}`,
      answer: `${opt.bid} at ${opt.ask}`,
      given: `${bid} at ${ask}`,
      ms: performance.now() - quoteAt.current,
      misses: 0,
      correct: e >= 0,
      points: round(e, 1),
      tags: {
        expected: round(e, 1),
        optimalExpected: round(opt.e, 1),
        shortfall: round(opt.e - e, 1),
        width: ask - bid,
        optimalWidth: opt.ask - opt.bid,
        widthCall: ask - bid > opt.ask - opt.bid + 6 ? 'too wide' : ask - bid < opt.ask - opt.bid - 6 ? 'too tight' : 'about right',
        midError: round(mid - 100 * qNow, 1),
        lean: mid - 100 * qNow > 5 ? 'high' : mid - 100 * qNow < -5 ? 'low' : 'centred',
        posterior: round(qNow, 3),
        after: prev ? prev.action : 'start',
        action,
        informedShare: mu,
        traderIndex: tape.length + 1,
        pnl,
      },
    })
    scoreRef.current += e
    setScore(scoreRef.current)
    q.current = update(qNow, action, bid, ask, mu)
    const nextTape = [...tape, { action, bid, ask }]
    setTape(nextTape)
    quoteAt.current = performance.now()
    if (nextTape.length >= cfg.traders) {
      realised.current += roundPnl.current
      setPhase('reveal')
      setNote(`Resolved ${V.current ? 'YES' : 'NO'}. Realised ${roundPnl.current >= 0 ? '+' : ''}${roundPnl.current} this round. The tape implied ${Math.round(q.current * 100)}% by the end.`)
      setTimeout(() => {
        const done = roundNo + 1
        if (done >= cfg.rounds) finish()
        else {
          setRoundNo(done)
          newRound()
        }
      }, 2600)
    }
  }

  return (
    <RunFrame
      pct={((cfg.rounds - roundNo) / cfg.rounds) * 100}
      left={
        <>
          {Math.min(roundNo + 1, cfg.rounds)}/{cfg.rounds}
          <span className="run__sep">
            trader {Math.min(tape.length + 1, cfg.traders)}/{cfg.traders}
          </span>
        </>
      }
      right={(score > 0 ? '+' : '') + score.toFixed(0)}
      countdown={phase === 'countdown' ? count : null}
      hint="Type bid, Tab, ask, Enter. One quote per trader. Esc to stop"
      wide
    >
      <div className="maker">
        <p className="muted">
          YES pays 100. Prior <strong className="tnum">{Math.round(prior * 100)}%</strong>. {Math.round(mu * 100)}% of traders know the answer.
        </p>
        <ul className="maker__tape tnum">
          {tape.map((t, i) => (
            <li key={i} className={`is-${t.action}`}>
              <span className="muted">{i + 1}.</span>{' '}
              {t.action === 'buy' ? `Bought from you at ${t.ask}` : t.action === 'sell' ? `Sold to you at ${t.bid}` : `No trade at ${t.bid} / ${t.ask}`}
            </li>
          ))}
        </ul>
        {phase === 'quote' && <QuoteInput key={`${roundNo}-${tape.length}`} onSubmit={onQuote} disabled={false} step={1} />}
        {note && (
          <div className="rounds__feedback is-right" role="status">
            <span>{note}</span>
          </div>
        )}
      </div>
    </RunFrame>
  )
}

function Summary({ attempt }: { attempt: Attempt<MakerConfig> }) {
  const rows = attempt.answers
  if (rows.length === 0) return null
  const afterBuy = rows.filter((l) => l.tags?.after === 'buy')
  const afterSell = rows.filter((l) => l.tags?.after === 'sell')
  const mean = (xs: EventLog[], k: string) => (xs.length ? xs.reduce((s, l) => s + Number(l.tags?.[k] ?? 0), 0) / xs.length : NaN)
  const shortfall = mean(rows, 'shortfall')
  const wide = rows.filter((l) => l.tags?.widthCall === 'too wide').length
  const tight = rows.filter((l) => l.tags?.widthCall === 'too tight').length
  return (
    <section className="result__section">
      <h2>Quoting</h2>
      <p className="muted tnum">
        Your quotes left {shortfall.toFixed(1)} cents a quote on the table against the best possible quote. {wide} were too wide, {tight} too tight.
        {afterBuy.length >= 3 ? ` After a buy your mid sat ${mean(afterBuy, 'midError') >= 0 ? 'above' : 'below'} the tape by ${Math.abs(mean(afterBuy, 'midError')).toFixed(1)} on average.` : ''}
        {afterSell.length >= 3 ? ` After a sell, ${mean(afterSell, 'midError') >= 0 ? 'above' : 'below'} by ${Math.abs(mean(afterSell, 'midError')).toFixed(1)}.` : ''}
        {' '}Realised over the run: {Number(attempt.meta?.realised ?? 0) >= 0 ? '+' : ''}
        {attempt.meta?.realised ?? 0}.
      </p>
      <p className="faint">The rule the model gives: after a buy, move both prices up; after a sell, move both down; the more informed the flow, the more you move and the wider you quote.</p>
    </section>
  )
}

function Settings({ cfg, setCfg }: { cfg: MakerConfig; setCfg: (f: (c: MakerConfig) => MakerConfig) => void }) {
  return (
    <>
      <Setting title="Rounds">
        <Seg options={[5, 10] as const} value={cfg.rounds} onChange={(r) => setCfg((c) => ({ ...c, rounds: r }))} label="Rounds" />
      </Setting>
      <Setting title="Traders a round">
        <Seg options={[6, 10] as const} value={cfg.traders} onChange={(t) => setCfg((c) => ({ ...c, traders: t }))} label="Traders" />
      </Setting>
      <Setting title="Informed share" note="The share of traders who know the outcome. The rest trade on a private value, so they trade less when your quote is wide.">
        <Seg options={[0.2, 0.4, 0.6] as const} value={cfg.informed} onChange={(i) => setCfg((c) => ({ ...c, informed: i }))} label="Informed" format={(i) => `${Math.round(i * 100)}%`} />
      </Setting>
    </>
  )
}

export const eventMakerSpec: CognitiveSpec<MakerConfig> = {
  id: 'event-maker',
  title: 'Make the market on an event',
  blurb: 'Quote bid and ask in cents on a YES contract. Some traders know the answer. Read the tape, move your prices, and do not get picked off.',
  defaults: { rounds: 5, traders: 6, informed: 0.4 },
  configKey: (c) => `mk:r${c.rounds}:t${c.traders}:i${c.informed}`,
  describe: (c) => `${c.rounds} rounds of ${c.traders} traders, ${Math.round(c.informed * 100)}% informed`,
  Settings,
  Run,
  Summary,
  pointsLabel: 'expected profit of your quotes in cents, given what the tape had shown',
  unit: 'c',
  pace: false,
  breakdowns: [
    { title: 'By width', key: (e) => String(e.tags?.widthCall ?? ''), order: ['too tight', 'about right', 'too wide'] },
    { title: 'By lean against the tape', key: (e) => (e.tags?.lean === 'high' ? 'Mid too high' : e.tags?.lean === 'low' ? 'Mid too low' : 'Mid about right'), order: ['Mid too low', 'Mid about right', 'Mid too high'] },
    { title: 'By what came before', key: (e) => (e.tags?.after === 'buy' ? 'After a buy' : e.tags?.after === 'sell' ? 'After a sell' : e.tags?.after === 'none' ? 'After no trade' : 'First quote'), order: ['First quote', 'After a buy', 'After a sell', 'After no trade'] },
  ],
}
