import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import DiceField from '../components/DiceField'
import { store } from '../lib/storage'
import type { Attempt } from '../lib/types'
import { sections } from '../app/sections'
import './home.css'

function startOfDay(ts: number) {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function streakDays(attempts: Attempt[]) {
  if (!attempts.length) return 0
  const days = new Set(attempts.map((a) => startOfDay(a.ts)))
  let s = 0
  let cursor = startOfDay(Date.now())
  if (!days.has(cursor)) cursor -= 86400000
  while (days.has(cursor)) {
    s++
    cursor -= 86400000
  }
  return s
}

const descriptions: Record<string, string> = {
  '/drill/speed-arithmetic': 'Typed answers against a clock. The Zetamac format, with history.',
  '/drill/eighty-in-eight': 'Eighty multiple-choice questions, eight minutes, minus one for a miss.',
  '/drill/sequences': 'Next term in the pattern. The Flow Traders and Maven test.',
  '/drill/fractions': 'Sevenths, thirteenths, sixteenths, to five places, from memory.',
  '/drill/percentages': 'Basis points, compound moves, reverse percentages, margins.',
  '/game/dice-market': 'Some dice face up, some hidden. Price the sum, trade the quote.',
  '/game/cards': 'Three cards, a two-sided market, and a P&L you compute yourself.',
  '/game/make-a-market': 'Quote a fact you half-know. Get traded on. Requote.',
  '/game/betting-board': 'A board of odds on coins, dice and cards. Find the wrong ones.',
  '/game/kelly': 'How much of the bankroll, given the edge.',
  '/game/etf-arb': 'An ETF against its basket. Sum the weights, hit the gap first.',
  '/game/event-contracts': 'Base rate, evidence, posterior, two-sided quote in cents.',
  '/game/fermi': 'Order-of-magnitude estimates with confidence intervals, scored on a log scale.',
  '/game/memory-grid': 'Cells flash; rebuild the pattern.',
  '/game/task-switch': 'Two rules, one stimulus, no warning when the rule changes.',
  '/game/intercept': 'Lead a falling target with a cannon that has travel time.',
  '/game/balloon': 'Pump for money, stop before it pops, learn the colours.',
  '/bank': 'Probability, expected value, Markov chains, brainteasers, with hints and full solutions.',
  '/mock': 'Firm-format timed sets: DRW, Citadel, SIG, Mako.',
  '/techniques': 'The moves behind the problems, scheduled for review when you slip.',
}

export default function Home() {
  const [attempts, setAttempts] = useState<Attempt[] | null>(null)
  useEffect(() => {
    store.listAttempts().then(setAttempts)
  }, [])

  const weekAgo = Date.now() - 7 * 86400000
  const thisWeek = attempts?.filter((a) => a.ts > weekAgo) ?? []
  const streak = attempts ? streakDays(attempts) : 0
  const best60 = attempts
    ?.filter((a) => a.drill === 'speed-arithmetic' && a.durationSec === 60)
    .reduce((m, a) => Math.max(m, a.score), 0)

  return (
    <div className="home">
      <section className="hero">
        <DiceField className="hero__field" />

        <div className="hero__text">
          <h1 className="display hero__title">
            <span data-word="Quote" aria-label="Quote" />
            <span data-word="fast." aria-label="fast." />
            <span data-word="Quote" aria-label="Quote" />
            <span data-word="right." aria-label="right." />
          </h1>

          {attempts === null ? null : attempts.length === 0 ? (
            <p className="hero__status">Nothing logged yet. The first run sets the baseline.</p>
          ) : (
            <p className="hero__status">
              {thisWeek.length} {thisWeek.length === 1 ? 'session' : 'sessions'} this week
              {streak > 1 ? `, ${streak} days running` : ''}.
              {best60 ? ` Best minute so far: ${best60}.` : ''}
            </p>
          )}

          <div className="hero__actions">
            <Link to="/drill/speed-arithmetic" className="btn btn-yellow">
              Start a drill
            </Link>
            <Link to="/progress" className="btn btn-ghost">
              Progress
            </Link>
          </div>
          <p className="hero__hint faint">Move the cursor through the dice.</p>
        </div>
      </section>

      <section className="index page">
        {sections.map((g, i) => (
          <div className="index__group" key={g.title}>
            <div className="index__head">
              <span className="index__num tnum">{String(i + 1).padStart(2, '0')}</span>
              <h2 className="display index__title">{g.title}</h2>
            </div>
            <ul>
              {g.links.map((l) => (
                <li key={l.to} className={l.status === 'soon' ? 'is-soon' : ''}>
                  <div className="index__row">
                    {l.status === 'live' ? <Link to={l.to}>{l.label}</Link> : <span>{l.label}</span>}
                    {l.status === 'soon' && <em>next build</em>}
                  </div>
                  <p>{descriptions[l.to]}</p>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    </div>
  )
}
