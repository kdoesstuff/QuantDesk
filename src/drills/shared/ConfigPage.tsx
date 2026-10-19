import type { FC } from 'react'
import { useNavigate } from 'react-router-dom'
import type { DrillId } from '../../lib/types'
import { useDrillConfig } from '../../lib/config'
import { ConfigFrame, Standing } from './Frames'
import FocusCard from '../../insights/FocusCard'
import RunLog from './RunLog'

/** What every drill spec shares, enough for the settings page. */
export interface BaseSpec<C extends object> {
  id: DrillId
  title: string
  blurb: string
  defaults: C
  configKey: (c: C) => string
  describe: (c: C) => string
  Settings: FC<{ cfg: C; setCfg: (f: (c: C) => C) => void }>
  valid?: (c: C) => boolean
  unit?: string
  higherIsBetter?: boolean
}

export default function ConfigPage<C extends object>({ spec }: { spec: BaseSpec<C> }) {
  const nav = useNavigate()
  const [cfg, setCfg] = useDrillConfig<C>(spec.id, spec.defaults)
  const key = spec.configKey(cfg)
  const valid = spec.valid ? spec.valid(cfg) : true
  const start = () => nav(`/drill/${spec.id}/run`)
  return (
    <ConfigFrame
      title={spec.title}
      blurb={spec.blurb}
      onStart={start}
      valid={valid}
      below={<RunLog drill={spec.id} currentKey={key} />}
      aside={
        <div className="drill-config__aside">
          <FocusCard drill={spec.id} onApply={(c) => setCfg((cur) => ({ ...cur, ...(c as Partial<C>) }))} />
          <Standing drill={spec.id} configKey={key} unit={spec.unit} higherIsBetter={spec.higherIsBetter ?? true} />
        </div>
      }
    >
      <spec.Settings cfg={cfg} setCfg={(f) => setCfg((c) => f(c))} />
    </ConfigFrame>
  )
}
