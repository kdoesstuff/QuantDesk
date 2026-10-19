import type { DrillId } from '../lib/types'
import type { Finding } from './analyze'
import { idForLabel } from './features'

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
        return patch(
          { ops: ['mul', 'div'], mulLeftMin: n, mulLeftMax: n },
          `Only the ${n} times table, multiplied and divided, until it is automatic.`,
        )
      }
      if (d === 'Divisor') {
        const n = num(v)
        if (Number.isNaN(n)) return none('Division by two-digit numbers: estimate the quotient from the leading digits first.')
        return patch({ ops: ['div'], mulLeftMin: n, mulLeftMax: n }, `Only division by ${n}.`)
      }
      if (d === 'Carry')
        return patch({ ops: ['add'] }, 'Addition only. Add the tens first, then the units, and say the carry out loud in your head.')
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
      if (d === 'Question type') return patch({ families: [idForLabel(drill, v)] }, `Only ${v.toLowerCase()} questions.`)
      return none('Skip the shapes you are unsure of; a skip is free, a wrong answer is not.')
    case 'sequences':
      if (d === 'Family') return patch({ families: [idForLabel(drill, v)] }, `Only the ${v.toLowerCase()} family.`)
      if (d === 'Level') return patch({ level: num(v) }, `Stay on level ${num(v)}.`)
      return none('Write the differences under the terms; most families show themselves in the second row.')
    case 'fractions':
      if (d === 'Mode') return patch({ modes: [idForLabel(drill, v)] }, `Only ${v.toLowerCase()}.`)
      if (d === 'Denominator')
        return patch({ denoms: [num(v)], modes: ['toDecimal', 'reciprocal'] }, `Only ${v}. Learn the cycle once and the rest is counting.`)
      return none('Reciprocals of two-digit numbers: anchor on the nearest tenth and adjust.')
    case 'percentages':
      if (d === 'Type') return patch({ types: [idForLabel(drill, v)] }, `Only ${v.toLowerCase()} problems.`)
      return none('Decimals and negatives: write the sign first, then the digits.')
    case 'dice-market':
    case 'cards-market':
      if (d === 'Mode') return patch({ mode: idForLabel(drill, v) }, `${v} mode only.`)
      if (d === 'Market lean') return patch({ mode: 'take' }, 'Take mode only. Compute fair before you look at the quote, then compare.')
      if (d === 'Hidden') return patch({ hidden: num(v) }, `Always ${num(v)} hidden.`)
      return none('Compute fair first, then the quote.')
    case 'make-a-market':
      if (d === 'Topic') return patch({ categories: [idForLabel(drill, v)] }, `Only ${v.toLowerCase()} questions.`)
      return none('Anchor on a number you know, scale by a factor you can defend.')
    case 'kelly':
      if (d === 'Variant') return patch({ variants: [idForLabel(drill, v)] }, `Only ${v.toLowerCase()}.`)
      return none('p minus q over b, in that order, every time.')
    case 'etf-arb':
      if (d === 'Gap') return patch({ level: v.includes('under') ? 3 : 2 }, 'Smaller gaps. Sum to the cent before deciding.')
      if (d === 'Names') return patch({ names: num(v) }, `Baskets of ${num(v)}.`)
      return none('Sum the weighted prices first, decide second.')
    case 'event-contracts':
      if (d === 'Variant') return patch({ variants: [idForLabel(drill, v)] }, `Only ${v.toLowerCase()} problems.`)
      return none('Work in odds, not probabilities: prior odds times likelihood ratio.')
    case 'fermi':
      if (d === 'Topic') return patch({ topics: [idForLabel(drill, v)] }, `Only ${v.toLowerCase()} questions.`)
      return none('Write the chain of factors before the number.')
    case 'dutch-book':
      if (d === 'Level') return patch({ level: num(v) }, `Stay on level ${num(v)}.`)
      return none(
        'Check the rules in order: and below both legs, or above both legs, or equals A plus B minus and, complements sum to 100.',
      )
    case 'race':
    case 'evidence':
      if (d === 'Market')
        return patch({ bot: v.startsWith('Lagging') ? 'lag' : v.startsWith('Jumpy') ? 'jumpy' : 'mixed' }, `Only ${v.toLowerCase()}s.`)
      return none('Work out fair before you look at the quote, then compare.')
    case 'event-maker':
      if (d === 'Informed share') return patch({ informed: num(v) / 100 }, `Stay at ${v}.`)
      return none('After a buy move both prices up, after a sell both down. Wider when more of the flow is informed.')
    case 'tricks':
      if (d === 'Trick') return patch({ tricks: [idForLabel(drill, v)] }, `Only the ${v.toLowerCase()} trick until it is automatic.`)
      if (d === 'Level') return patch({ level: num(v) }, `Stay on level ${num(v)}.`)
      return none('Name the trick before you compute; the review shows which one each problem wants.')
    case 'dice-games':
      if (d === 'Game') return patch({ families: [idForLabel(drill, v)] }, `Only that game until fair comes out without thinking.`)
      if (d === 'Mode') return patch({ mode: idForLabel(drill, v) }, `${v} mode only.`)
      if (d === 'Market lean') return patch({ mode: 'take' }, 'Take mode only. Compute fair before you look at the quote, then compare.')
      return none('Compute fair first, write it down, then look at the quote.')
    case 'stop-or-roll':
      if (d === 'What') return patch({ mode: idForLabel(drill, v) }, `${v} only.`)
      if (d === 'Draws left') return none(`Work out the bar with ${v}: it is the value of going on from there. Keep anything above it.`)
      return none('The bar is the expected value of what is left. Compare, do not feel.')
    default:
      return none('Keep playing; this one is about repetition, not settings.')
  }
}
