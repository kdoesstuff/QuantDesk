import { useParams } from 'react-router-dom'
import { CategoryTable, Missing, ResultFrame, useAttempt } from '../shared/Frames'
import PaceChart from '../shared/PaceChart'
import InsightsPanel from '../../insights/InsightsPanel'
import Review from '../shared/Review'
import { breakdownRows } from '../typed/Result'
import type { CognitiveSpec } from './spec'

export default function CognitiveResult<C extends object>({ spec }: { spec: CognitiveSpec<C> }) {
  const { id } = useParams()
  const attempt = useAttempt<C>(spec.id, id)
  if (attempt === undefined) return null
  if (!attempt) return <Missing drill={spec.id} />
  const places = spec.places ?? 0
  const f = (x: number) => (places > 0 ? x.toFixed(places) : String(Math.round(x)))
  const decided = attempt.answers.filter((l) => l.given !== null)
  return (
    <ResultFrame
      drill={spec.id}
      attempt={attempt}
      subtitle={`${spec.title}, ${spec.describe(attempt.config)}`}
      scoreText={f(attempt.score)}
      line={`Score is ${spec.pointsLabel}.`}
      unit={spec.unit}
      higherIsBetter={spec.higherIsBetter ?? true}
    >
      <InsightsPanel drill={spec.id} attempt={attempt} />
      {spec.Summary ? <spec.Summary attempt={attempt} /> : null}
      {spec.review && <Review events={attempt.answers} intro={spec.review} />}
      {spec.pace !== false && decided.length > 1 && (
        <section className="result__section">
          <h2>Pace</h2>
          <p className="muted">{spec.paceLabel ?? 'Seconds per trial, in order. Blue is right, red is wrong.'}</p>
          <PaceChart
            ms={decided.map((l) => l.ms)}
            colours={decided.map((l) => (l.correct ? 'var(--blue-2)' : 'var(--wrong)'))}
            label="Seconds per trial"
          />
        </section>
      )}
      {spec.breakdowns.map((b) => {
        const rows = breakdownRows(attempt.answers, b.key, b.order)
        if (rows.length === 0) return null
        return (
          <section className="result__section" key={b.title}>
            <h2>{b.title}</h2>
            <CategoryTable rows={rows} head={['', 'Trials', 'Right', 'Median']} />
          </section>
        )
      })}
    </ResultFrame>
  )
}
