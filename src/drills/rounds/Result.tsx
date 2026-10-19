import { useParams } from 'react-router-dom'
import { median } from 'd3'
import { CategoryTable, Missing, ResultFrame, useAttempt } from '../shared/Frames'
import PaceChart from '../shared/PaceChart'
import InsightsPanel from '../../insights/InsightsPanel'
import { breakdownRows } from '../typed/Result'
import type { RoundsSpec, Scenario } from './spec'

export default function RoundsResult<C extends object, S extends Scenario, D>({ spec }: { spec: RoundsSpec<C, S, D> }) {
  const { id } = useParams()
  const attempt = useAttempt<C>(spec.id, id)
  if (attempt === undefined) return null
  if (!attempt) return <Missing drill={spec.id} />

  const places = spec.places ?? 0
  const f = (x: number) => (places > 0 ? x.toFixed(places) : String(Math.round(x)))
  const decided = attempt.answers.filter((l) => l.given !== null)
  const med = decided.length ? median(decided.map((l) => l.ms))! / 1000 : 0
  const timedOut = attempt.answers.length - decided.length
  const line = `${attempt.answers.length} rounds, ${attempt.correct} right${timedOut ? `, ${timedOut} timed out` : ''}, ${med.toFixed(1)}s a decision. Score is ${spec.pointsLabel}.`

  return (
    <ResultFrame
      drill={spec.id}
      attempt={attempt}
      subtitle={`${spec.title}, ${spec.describe(attempt.config)}`}
      scoreText={(attempt.score > 0 ? '+' : '') + f(attempt.score)}
      line={line}
      unit={spec.unit}
      higherIsBetter={spec.higherIsBetter ?? true}
    >
      <InsightsPanel drill={spec.id} attempt={attempt} />

      {spec.Summary ? <spec.Summary attempt={attempt} /> : null}

      {decided.length > 1 && (
        <section className="result__section">
          <h2>Pace</h2>
          <p className="muted">Seconds per decision, in order. Blue is a right call, red a wrong one.</p>
          <PaceChart ms={decided.map((l) => l.ms)} colours={decided.map((l) => (l.correct ? 'var(--blue-2)' : 'var(--wrong)'))} label="Seconds per decision" />
        </section>
      )}

      {spec.breakdowns.map((b) => {
        const rows = breakdownRows(attempt.answers, b.key, b.order)
        if (rows.length === 0) return null
        return (
          <section className="result__section" key={b.title}>
            <h2>{b.title}</h2>
            <CategoryTable rows={rows.map((r) => ({ ...r, firstTry: r.firstTry }))} head={['', 'Rounds', 'Right', 'Median']} />
          </section>
        )
      })}

      <section className="result__section">
        <h2>Round by round</h2>
        <ul className="slips tnum">
          {attempt.answers.map((l, i) => (
            <li key={i} className={l.correct ? '' : 'is-wrong'}>
              <span>
                <span className="muted">{i + 1}.</span> {l.prompt}
              </span>
              <span className={l.correct ? 'muted' : ''}>
                {l.given === null ? 'timed out' : l.given}
                {!l.correct && l.answer !== undefined ? `, right was ${l.answer}` : ''}
                {typeof l.points === 'number' ? ` (${l.points > 0 ? '+' : ''}${f(l.points)})` : ''}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </ResultFrame>
  )
}
