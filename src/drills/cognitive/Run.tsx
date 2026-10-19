import { useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Attempt } from '../../lib/types'
import { store, uid } from '../../lib/storage'
import { loadDrillConfig } from '../../lib/config'
import { round } from '../../lib/random'
import type { CognitiveSpec, Finished } from './spec'

export default function CognitiveRun<C extends object>({ spec }: { spec: CognitiveSpec<C> }) {
  const nav = useNavigate()
  const cfg = useRef<C>(loadDrillConfig(spec.id, spec.defaults)).current
  const done = useRef(false)
  const onDone = useCallback(
    async (f: Finished) => {
      if (done.current) return
      done.current = true
      const attempt: Attempt<C> = {
        id: uid(),
        ts: Date.now(),
        drill: spec.id,
        configKey: spec.configKey(cfg),
        config: cfg,
        score: round(f.score, spec.places ?? 0),
        correct: f.correct,
        wrong: f.wrong,
        durationSec: f.durationSec,
        answers: f.logs,
        meta: f.meta,
      }
      await store.saveAttempt(attempt)
      nav(`/drill/${spec.id}/result/${attempt.id}`, { replace: true })
    },
    [cfg, nav, spec],
  )
  const onQuit = useCallback(() => nav(`/drill/${spec.id}`), [nav, spec.id])
  return <spec.Run cfg={cfg} onDone={onDone} onQuit={onQuit} />
}
