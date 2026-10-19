import type { Operation, SpeedArithmeticConfig } from '../../lib/types'
import { loadDrillConfig, saveDrillConfig } from '../../lib/config'

export interface Problem {
  op: Operation
  a: number
  b: number
  answer: number
  text: string
}

export const DEFAULT_CONFIG: SpeedArithmeticConfig = {
  durationSec: 120,
  ops: ['add', 'sub', 'mul', 'div'],
  addMin: 2,
  addMax: 100,
  mulLeftMin: 2,
  mulLeftMax: 12,
  mulRightMin: 2,
  mulRightMax: 100,
}

export function loadConfig(): SpeedArithmeticConfig {
  return loadDrillConfig('speed-arithmetic', DEFAULT_CONFIG)
}

export function saveConfig(c: SpeedArithmeticConfig) {
  saveDrillConfig('speed-arithmetic', c)
}

export function configKey(c: SpeedArithmeticConfig) {
  const ops = (['add', 'sub', 'mul', 'div'] as Operation[]).filter((o) => c.ops.includes(o)).join('')
  return `sa:${c.durationSec}:${ops}:${c.addMin}-${c.addMax}:${c.mulLeftMin}-${c.mulLeftMax}x${c.mulRightMin}-${c.mulRightMax}`
}

function rint(min: number, max: number) {
  return min + Math.floor(Math.random() * (max - min + 1))
}

export function nextProblem(c: SpeedArithmeticConfig, prev?: Problem): Problem {
  const ops = c.ops.length ? c.ops : (['add'] as Operation[])
  let op = ops[Math.floor(Math.random() * ops.length)]
  // Avoid three identical operations in a row when there is a choice.
  if (prev && ops.length > 1 && op === prev.op && Math.random() < 0.5) {
    op = ops[(ops.indexOf(op) + 1 + Math.floor(Math.random() * (ops.length - 1))) % ops.length]
  }

  switch (op) {
    case 'add': {
      const a = rint(c.addMin, c.addMax)
      const b = rint(c.addMin, c.addMax)
      return { op, a, b, answer: a + b, text: `${a} + ${b}` }
    }
    case 'sub': {
      // Inverse of addition so the answer is always a positive integer in range.
      const x = rint(c.addMin, c.addMax)
      const y = rint(c.addMin, c.addMax)
      return { op, a: x + y, b: x, answer: y, text: `${x + y} − ${x}` }
    }
    case 'mul': {
      const a = rint(c.mulLeftMin, c.mulLeftMax)
      const b = rint(c.mulRightMin, c.mulRightMax)
      // Randomise which side the small factor is on.
      return Math.random() < 0.5
        ? { op, a, b, answer: a * b, text: `${a} × ${b}` }
        : { op, a: b, b: a, answer: a * b, text: `${b} × ${a}` }
    }
    case 'div': {
      const a = rint(c.mulLeftMin, c.mulLeftMax)
      const b = rint(c.mulRightMin, c.mulRightMax)
      return { op, a: a * b, b: a, answer: b, text: `${a * b} ÷ ${a}` }
    }
  }
}

export const OP_LABEL: Record<Operation, string> = {
  add: 'Addition',
  sub: 'Subtraction',
  mul: 'Multiplication',
  div: 'Division',
}

export const OP_SIGN: Record<Operation, string> = {
  add: '+',
  sub: '−',
  mul: '×',
  div: '÷',
}
