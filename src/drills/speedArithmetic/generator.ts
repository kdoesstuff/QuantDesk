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
      return Math.random() < 0.5 ? { op, a, b, answer: a * b, text: `${a} × ${b}` } : { op, a: b, b: a, answer: a * b, text: `${b} × ${a}` }
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

/** The approach for one problem, in words with the numbers, for the review. */
export function howArithmetic(op: Operation, a: number, b: number): string {
  switch (op) {
    case 'add': {
      const u = b % 10
      if (b >= 10 && u >= 7) {
        const up = b + (10 - u)
        return `Round ${b} up to ${up}: ${a} + ${up} = ${a + up}, then take back ${10 - u}: ${a + b}.`
      }
      const at = a - (a % 10)
      const bt = b - (b % 10)
      if (at && bt) return `Tens first: ${at} + ${bt} = ${at + bt}. Units: ${a % 10} + ${u} = ${(a % 10) + u}. Total ${a + b}.`
      return `${a} + ${b} = ${a + b}. Add the bigger number first, then the smaller one in one step.`
    }
    case 'sub': {
      const ans = a - b
      const next = b + (10 - (b % 10))
      if (b % 10 !== 0 && next <= a)
        return `Count up from ${b}: to ${next} is ${next - b}, then ${next} to ${a} is ${a - next}. Together ${next - b} + ${a - next} = ${ans}.`
      return `${a} − ${b}: take the tens, ${a} − ${b - (b % 10)} = ${a - (b - (b % 10))}, then the units, minus ${b % 10} = ${ans}.`
    }
    case 'mul': {
      const small = Math.min(a, b)
      const large = Math.max(a, b)
      const u = large % 10
      if (large >= 10 && u >= 7) {
        const up = large + (10 - u)
        return `${small} × ${large}: go up to ${up}, ${small} × ${up} = ${small * up}, then take back ${small} × ${10 - u} = ${small * (10 - u)}: ${small * large}.`
      }
      if (large >= 10) {
        const tens = large - u
        return `${small} × ${large}: split ${large} into ${tens} and ${u}. ${small} × ${tens} = ${small * tens}, ${small} × ${u} = ${small * u}, total ${small * large}.`
      }
      return `${small} × ${large} = ${small * large}, a times-table fact worth knowing cold.`
    }
    case 'div': {
      const q = a / b
      const tens = Math.floor(q / 10) * 10
      if (tens >= 10)
        return `${a} ÷ ${b}: ${b} × ${tens} = ${b * tens}, leaving ${a - b * tens}, and ${b} × ${q - tens} = ${a - b * tens}. So ${tens} + ${q - tens} = ${q}.`
      return `${a} ÷ ${b}: ask what times ${b} gives ${a}. ${b} × ${q} = ${a}, so ${q}.`
    }
  }
}
