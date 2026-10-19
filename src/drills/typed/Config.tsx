import ConfigPage from '../shared/ConfigPage'
import type { TypedSpec } from './spec'

export default function TypedConfig<C extends object>({ spec }: { spec: TypedSpec<C> }) {
  return <ConfigPage spec={spec} />
}
