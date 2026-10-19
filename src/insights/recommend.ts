import type { DrillId } from '../lib/types'
import type { Finding } from './analyze'

/**
 * Turns a weak category into a settings patch the drill can run with, so a
 * focus block plays exactly the thing that is slow. Not every dimension
 * can be forced by settings; those get advice instead of a patch.
 */
export interface Recommendation {
  label: string
  patch: Record<string, unknown> | null
  advice: string
}

function uncap(s: string) {
  return s.charAt(0).toLowerCase() + s.slice(1)
}

function num(s: string) {
  const m = s.match(/-?\d+/)
  return m ? Number(m[0]) : NaN
}

export function recommend(f: Finding): Recommendation | null {
  if (!f.dim || !f.value) return null
  const d = f.dim
  const v = f.value
  const label = `${v}`
  const none = (advice: string): Recommendation => ({ label, patch: null, advice })
  const patch = (p: Record<string, unknown>, advice: string): Recommendation => ({ label, patch: p, advice })
  const drill: DrillId = f.drill

  switch (drill) {
    case 'speed-arithmetic': {
      if (d === 'Operation') {
        const op = { Addition: 'add', Subtraction: 'sub', Multiplication: 'mul', Division: 'div' }[v]
        return patch({ ops: [op] }, `Runs with only ${v.toLowerCase()} until the median comes down.`)
      }
      if (d === 'Times table') {
        const n = num(v)
        if (Number.isNaN(n)) return none('Large factors are slow; practise the two-digit by one-digit split.')
        return patch({ ops: ['mul', 'div'], mulLeftMin: n, mulLeftMax: n }, `Only the ${n} times table, multiplied and divided, until it is automatic.`)
      }
      if (d === 'Divisor') {
        const n = num(v)
        if (Number.isNaN(n)) return none('Division by two-digit numbers: estimate the quotient from the leading digits first.')
        return patch({ ops: ['div'], mulLeftMin: n, mulLeftMax: n }, `Only division by ${n}.`)
      }
      if (d === 'Carry') return patch({ ops: ['add'] }, 'Addition only. Add the tens first, then the units, and say the carry out loud in your head.')
      if (d === 'Borrow') return patch({ ops: ['sub'] }, 'Subtraction only. Count up from the smaller number instead of borrowing down.')
      if (d === 'Operand size') {
        const n = num(v)
        const lo = 10 ** (n - 1)
        const hi = 10 ** n - 1
        return patch({ ops: ['add', 'sub'], addMin: lo, addMax: hi }, `Only ${n}-digit addends.`)
      }
      if (d === 'Large factor') {
        const n = num(v)
        return patch({ ops: ['mul', 'div'], mulRightMin: 10 ** (n - 1), mulRightMax: 10 ** n - 1 }, `Only ${n}-digit large factors.`)
      }
      return none('Mixed practice is still the right call here.')
    }
    case 'eighty-in-eight':
      if (d === 'Question type') return patch({ families: [uncap(v)] }, `Only ${v.toLowerCase()} questions.`)
      return none('Skip the shapes you are unsure of; a skip is free, a wrong answer is not.')
    case 'sequences':
      if (d === 'Family') return patch({ families: [uncap(v)] }, `Only the ${v.toLowerCase()} family.`)
      if (d === 'Level') return patch({ level: num(v) }, `Stay on level ${num(v)}.`)
      return none('Write the differences under the terms; most families show themselves in the second row.')
    case 'fractions':
      if (d === 'Mode') return patch({ modes: [uncap(v)] }, `Only ${v.toLowerCase()}.`)
      if (d === 'Denominator') return patch({ denoms: [num(v)], modes: ['toDecimal', 'reciprocal'] }, `Only ${v}. Learn the cycle once and the rest is counting.`)
      return none('Reciprocals of two-digit numbers: anchor on the nearest tenth and adjust.')
    case 'percentages':
      if (d === 'Type') return patch({ types: [uncap(v)] }, `Only ${v.toLowerCase()} problems.`)
      return none('Decimals and negatives: write the sign first, then the digits.')
    case 'dice-market':
    case 'cards-market':
      if (d === 'Mode') return patch({ mode: uncap(v) }, `${v} mode only.`)
      if (d === 'Market lean') return patch({ mode: 'take' }, 'Take mode only. Compute fair before you look at the quote, then compare.')
      if (d === 'Hidden') return patch({ hidden: num(v) }, `Always ${num(v)} hidden.`)
      return none('Compute fair first, then the quote.')
    case 'make-a-market':
      if (d === 'Topic') return patch({ categories: [uncap(v)] }, `Only ${v.toLowerCase()} questions.`)
      return none('Anchor on a number you know, scale by a factor you can defend.')
    case 'kelly':
      if (d === 'Variant') return patch({ variants: [uncap(v)] }, `Only ${v.toLowerCase()}.`)
      return none('p minus q over b, in that order, every time.')
    case 'etf-arb':
      if (d === 'Gap') return patch({ level: v.includes('under') ? 3 : 2 }, 'Smaller gaps. Sum to the cent before deciding.')
      if (d === 'Names') return patch({ names: num(v) }, `Baskets of ${num(v)}.`)
      return none('Sum the weighted prices first, decide second.')
    case 'event-contracts':
      if (d === 'Variant') return patch({ variants: [uncap(v)] }, `Only ${v.toLowerCase()} problems.`)
      return none('Work in odds, not probabilities: prior odds times likelihood ratio.')
    case 'fermi':
      if (d === 'Topic') return patch({ topics: [uncap(v)] }, `Only ${v.toLowerCase()} questions.`)
      return none('Write the chain of factors before the number.')
    default:
      return none('Keep playing; this one is about repetition, not settings.')
  }
}
