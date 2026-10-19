import { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { median } from 'd3'
import type { EventLog } from '../../lib/types'
import { durationLabel } from '../../lib/config'
import { CategoryTable, Missing, ResultFrame, useAttempt } from '../shared/Frames'
import PaceChart from '../shared/PaceChart'
import InsightsPanel from '../../insights/InsightsPanel'
import type { TypedSpec } from './spec'

export function breakdownRows(events: EventLog[], key: (e: EventLog) => string | null, order?: string[]) {
  const m = new Map<string, EventLog[]>()
  for (const e of events) {
    const k = key(e)
    if (k === null) continue
    if (!m.has(k)) m.set(k, [])
    m.get(k)!.push(e)
  }
  const keys = [...m.keys()].sort((a, b) => {
    const ia = order?.indexOf(a) ?? -1
    const ib = order?.indexOf(b) ?? -1
    if (ia !== -1 || ib !== -1) return (ia === -1 ? 1e9 : ia) - (ib === -1 ? 1e9 : ib)
    return a.localeCompare(b)
  })
  return keys.map((k) => {
    const rows = m.get(k)!
    return {
      label: k,
      n: rows.length,
      firstTry: rows.filter((r) => r.correct && r.misses === 0).length,
      medMs: rows.length ? median(rows.map((r) => r.ms))! : 0,
    }
  })
}

export default function TypedResult<C extends object>({ spec }: { spec: TypedSpec<C> }) {
  const { id } = useParams()
  const attempt = useAttempt<C>(spec.id, id)

  const stats = useMemo(() => {
    if (!attempt) return null
    const answered = attempt.answers.filter((l) => l.given !== null && l.given !== 'skip')
    const slips = attempt.answers.filter((l) => l.misses > 0 || (!l.correct && l.given !== null && l.given !== 'skip'))
    const skipped = attempt.answers.filter((l) => l.given === 'skip').length
    return { answered, slips, skipped }
  }, [attempt])

  if (attempt === undefined) return null
  if (!attempt || !stats) return <Missing drill={spec.id} />

  const perMin = attempt.durationSec > 0 ? (attempt.correct / attempt.durationSec) * 60 : 0
  const line =
    spec.mode === 'choice'
      ? `${attempt.correct} right, ${attempt.wrong} wrong${stats.skipped ? `, ${stats.skipped} skipped` : ''}, in ${durationLabel(attempt.durationSec)}.`
      : `${Math.round(perMin)} a minute, ${attempt.wrong === 0 ? 'no slips.' : `${attempt.wrong} ${attempt.wrong === 1 ? 'slip.' : 'slips.'}`}`

  return (
    <ResultFrame
      drill={spec.id}
      attempt={attempt}
      subtitle={`${spec.title}, ${spec.describe(attempt.config)}`}
      line={line}
      unit={spec.unit}
    >
      <InsightsPanel drill={spec.id} attempt={attempt} />

      {stats.answered.length > 1 && (
        <section className="result__section">
          <h2>Pace</h2>
          <p className="muted">Seconds per problem, in order.</p>
          <PaceChart ms={stats.answered.map((l) => l.ms)} colours={spec.colour ? stats.answered.map(spec.colour) : undefined} />
        </section>
      )}

      {spec.breakdowns.map((b) => {
        const rows = breakdownRows(stats.answered, b.key, b.order)
        if (rows.length === 0) return null
        return (
          <section className="result__section" key={b.title}>
            <h2>{b.title}</h2>
            <CategoryTable rows={rows} head={['', 'Answered', spec.mode === 'choice' ? 'Right' : 'First try', 'Median']} />
          </section>
        )
      })}

      {stats.slips.length > 0 && (
        <section className="result__section">
          <h2>Where it slipped</h2>
          <ul className="slips tnum">
            {stats.slips.map((l, i) => (
              <li key={i}>
                <span>
                  {l.prompt} = {l.answer}
                </span>
                <span className="muted">
                  {spec.mode === 'choice'
                    ? `chose ${l.given}`
                    : `${l.misses} wrong ${l.misses === 1 ? 'try' : 'tries'}${l.given === null ? ', then time' : ''}`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </ResultFrame>
  )
}
