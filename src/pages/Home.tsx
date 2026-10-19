import { Link } from 'react-router-dom'
import DiceField from '../components/DiceField'
import GaltonBackdrop from '../components/GaltonBackdrop'
import { sections } from '../app/sections'
import './home.css'

const descriptions: Record<string, string> = {
  '/drill/speed-arithmetic': 'Typed answers against a clock. The Zetamac format, with history.',
  '/drill/eighty-in-eight': 'Eighty multiple-choice questions, eight minutes, minus one for a miss.',
  '/drill/sequences': 'Next term in the pattern. The Flow Traders and Maven test.',
  '/drill/fractions': 'Sevenths, thirteenths, sixteenths, to five places, from memory.',
  '/drill/percentages': 'Basis points, compound moves, reverse percentages, margins.',
  '/drill/dice-market': 'Some dice face up, some hidden. Price the sum, trade the quote.',
  '/drill/cards-market': 'Three cards, a two-sided market, and a P&L you compute yourself.',
  '/drill/make-a-market': 'Quote a fact you half-know. Get traded on. Requote.',
  '/drill/betting-board': 'A board of odds on coins, dice and cards. Find the wrong ones.',
  '/drill/kelly': 'How much of the bankroll, given the edge.',
  '/drill/etf-arb': 'An ETF against its basket. Sum the weights, hit the gap first.',
  '/drill/event-contracts': 'Base rate, evidence, posterior, two-sided quote in cents.',
  '/drill/race': 'Two runners, one contract, a market that lags or overshoots the true odds. Trade the gap.',
  '/drill/evidence': 'Flips arrive, the posterior moves, the market updates badly. You update well.',
  '/drill/event-maker': 'Quote both sides on an event. Some traders know the answer. Read the tape, move your prices.',
  '/drill/dutch-book': 'Related contracts, one price that breaks the rules of probability. Name the free money.',
  '/drill/fermi': 'Order-of-magnitude estimates with confidence intervals, scored on a log scale.',
  '/drill/memory-grid': 'Cells flash; rebuild the pattern.',
  '/drill/task-switch': 'Two rules, one stimulus, no warning when the rule changes.',
  '/drill/intercept': 'Lead a falling target with a cannon that has travel time.',
  '/drill/balloon': 'Pump for money, stop before it pops, learn the colours.',
}

export default function Home() {
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
          <div className="hero__actions">
            <Link to="/drill/speed-arithmetic" className="btn btn-yellow">
              Start a drill
            </Link>
            <Link to="/progress" className="btn btn-ghost">
              Progress
            </Link>
          </div>
        </div>
      </section>

      <section className="index">
        <GaltonBackdrop className="index__backdrop" />
        <div className="index__inner page">
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
        </div>
      </section>
    </div>
  )
}
