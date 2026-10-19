import { useParams } from 'react-router-dom'
import { CategoryTable, Missing, ResultFrame, useAttempt } from '../shared/Frames'
import InsightsPanel from '../../insights/InsightsPanel'
import { breakdownRows } from '../typed/Result'
import type { LiveConfig, LiveSpec } from './spec'

/** Tiny chart of one round: market price in yellow, true probability in blue, entry marked. */
function RoundPath({ path, side, tick }: { path: [number, number][]; side: string; tick: number }) {
  const W = 220
  const H = 48
  const n = Math.max(2, path.length)
  const x = (i: number) => 3 + (i / (n - 1)) * (W - 6)
  const y = (p: number) => H - 3 - p * (H - 6)
  const line = (k: 0 | 1) => path.map((q, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(q[k]).toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-hidden="true" className="live__mini">
      <path d={line(0)} fill="none" stroke="var(--blue-2)" strokeWidth="1.5" />
      <path d={line(1)} fill="none" stroke="var(--yellow)" strokeWidth="1.5" />
      {side !== 'pass' && tick < path.length && <circle cx={x(tick)} cy={y(path[tick][1])} r="3.5" fill={side === 'buy' ? 'var(--right)' : 'var(--wrong)'} />}
    </svg>
  )
}

export default function LiveResult<C extends LiveConfig, S>({ spec }: { spec: LiveSpec<C, S> }) {
  const { id } = useParams()
  const attempt = useAttempt<C>(spec.id, id)
  if (attempt === undefined) return null
  if (!attempt) return <Missing drill={spec.id} />
  const traded = attempt.answers.filter((l) => l.tags?.side !== 'pass')
  const realised = attempt.answers.reduce((s, l) => s + Number(l.tags?.realised ?? 0), 0)
  const missed = attempt.answers.filter((l) => l.tags?.missed).length
  const line = `${attempt.answers.length} rounds, ${traded.length} traded, ${attempt.correct} on the right side${missed ? `, ${missed} passed with edge on offer` : ''}. Realised ${realised >= 0 ? '+' : ''}${realised}. Score is expected edge in cents.`
  return (
    <ResultFrame drill={spec.id} attempt={attempt} subtitle={`${spec.title}, ${spec.describe(attempt.config)}`} scoreText={(attempt.score > 0 ? '+' : '') + attempt.score.toFixed(0)} line={line} unit="c">
      <InsightsPanel drill={spec.id} attempt={attempt} />
      {spec.Summary ? <spec.Summary attempt={attempt} /> : null}
      {spec.breakdowns.map((b) => {
        const rows = breakdownRows(attempt.answers, b.key, b.order)
        if (rows.length === 0) return null
        return (
          <section className="result__section" key={b.title}>
            <h2>{b.title}</h2>
            <CategoryTable rows={rows} head={['', 'Rounds', 'Right side', 'Median hold']} />
          </section>
        )
      })}
      <section className="result__section">
        <h2>Round by round</h2>
        <p className="muted">Blue is the true probability, yellow the market. The dot is your entry.</p>
        <ul className="slips tnum live__rounds">
          {attempt.answers.map((l, i) => {
            let path: [number, number][] = []
            try {
              path = JSON.parse(String(l.tags?.path ?? '[]')) as [number, number][]
            } catch {
              /* ignore */
            }
            const entryTick = l.ms && attempt.config.tickMs ? Math.round(l.ms / attempt.config.tickMs) : 0
            return (
              <li key={i} className={l.correct ? '' : 'is-wrong'}>
                <span>
                  <span className="muted">{i + 1}.</span> {l.prompt}, resolved {l.answer}
                </span>
                <RoundPath path={path} side={String(l.tags?.side)} tick={entryTick} />
                <span className={l.correct ? 'muted' : ''}>
                  {l.given}
                  {typeof l.points === 'number' && l.tags?.side !== 'pass' ? ` (${l.points > 0 ? '+' : ''}${l.points})` : l.tags?.missed ? ` (missed ${l.tags?.missedEdge})` : ''}
                </span>
              </li>
            )
          })}
        </ul>
      </section>
    </ResultFrame>
  )
}
