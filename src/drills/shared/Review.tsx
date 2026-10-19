import type { EventLog } from '../../lib/types'

/**
 * The review: every question that went wrong, was skipped or ran out of
 * time, with what was answered, what was right and how to get there. The
 * approach text comes from the generator that wrote the question, so the
 * numbers in it are the numbers that were on screen.
 */
export function reviewable(l: EventLog) {
  if (l.given === null) return true
  if (l.given === 'skip') return true
  if (!l.correct) return true
  return l.misses > 0
}

function given(l: EventLog) {
  if (l.given === null) return `ran out of time${l.tried !== undefined ? ` (tried ${l.tried})` : ''}`
  if (l.given === 'skip') return 'skipped'
  if (l.misses > 0 && l.correct)
    return `right after ${l.misses} wrong ${l.misses === 1 ? 'try' : 'tries'}${l.tried !== undefined ? ` (first tried ${l.tried})` : ''}`
  return String(l.given)
}

export default function Review({ events, title = 'Review', intro }: { events: EventLog[]; title?: string; intro?: string }) {
  const items = events.map((l, i) => ({ l, i })).filter(({ l }) => reviewable(l))
  if (items.length === 0) return null
  return (
    <section className="result__section review">
      <h2>{title}</h2>
      <p className="muted">{intro ?? `${items.length} to look at. The approach is written with the numbers that were on screen.`}</p>
      <ol className="review__list">
        {items.map(({ l, i }) => (
          <li key={i} className="review__item">
            <div className="review__head">
              <span className="review__n tnum">{i + 1}</span>
              <span className="review__prompt">{l.prompt}</span>
            </div>
            {l.detail && l.detail.length > 0 && (
              <dl className="review__detail tnum">
                {l.detail.map((d, j) => (
                  <div key={j}>
                    <dt>{d.label}</dt>
                    <dd>{d.value}</dd>
                  </div>
                ))}
              </dl>
            )}
            <div className="review__answers tnum">
              <span className={l.correct ? 'review__you' : 'review__you is-wrong'}>You: {given(l)}</span>
              {l.answer !== undefined && <span className="review__right">Right: {String(l.answer)}</span>}
            </div>
            {l.how &&
              l.how
                .split('\n')
                .filter((t) => t.trim())
                .map((t, j) => (
                  <p className="review__how" key={j}>
                    {t}
                  </p>
                ))}
          </li>
        ))}
      </ol>
    </section>
  )
}
