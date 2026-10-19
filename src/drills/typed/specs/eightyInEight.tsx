import { chance, pick, rint, round, shuffle } from '../../../lib/random'
import { Chips, Seg, Setting, toggleIn } from '../../shared/Frames'
import type { Item, TypedSpec } from '../spec'

/**
 * The Optiver format: eighty mixed arithmetic questions in eight minutes,
 * multiple choice, plus one for a right answer and minus one for a wrong one.
 * Skipping costs nothing, so the test is about knowing when you know.
 */
export type QFamily = 'addsub' | 'mul' | 'div' | 'decimal' | 'fraction' | 'percent' | 'square' | 'root' | 'order' | 'negative'
export const FAMILY_LABEL: Record<QFamily, string> = {
  addsub: 'Add and subtract',
  mul: 'Multiply',
  div: 'Divide',
  decimal: 'Decimals',
  fraction: 'Fractions',
  percent: 'Percent',
  square: 'Squares',
  root: 'Roots',
  order: 'Order of operations',
  negative: 'Negatives',
}
export const ALL_QFAMILIES: QFamily[] = ['addsub', 'mul', 'div', 'decimal', 'fraction', 'percent', 'square', 'root', 'order', 'negative']

export interface EightyConfig {
  /** Questions and minutes, same number. */
  size: 40 | 80 | 120
  penalty: 0 | 1 | 2
  families: QFamily[]
  /** Typed answers (harder, no hints from the options) or four options as in the real test. */
  answer: 'typed' | 'choice'
}

interface Q {
  prompt: string
  answer: number
  tags: Record<string, string | number | boolean>
  /** The approach, for the review. */
  how: string
}

const f4 = (x: number) => String(round(x, 4))

function gen(family: QFamily): Q {
  switch (family) {
    case 'addsub': {
      if (chance(0.5)) {
        const a = rint(100, 999)
        const b = rint(10, 999)
        const bt = b - (b % 100)
        return {
          prompt: `${a} + ${b}`,
          answer: a + b,
          how: `Add in chunks from the left: ${a} + ${bt} = ${a + bt}, then + ${b - bt} = ${a + b}.`,
          tags: { family, digits: 3, carry: (a % 10) + (b % 10) >= 10 },
        }
      }
      const a = rint(100, 999)
      const b = rint(10, a - 1)
      const bt = b - (b % 100)
      return {
        prompt: `${a} − ${b}`,
        answer: a - b,
        how: `Take the hundreds first: ${a} − ${bt} = ${a - bt}, then − ${b - bt} = ${a - b}. Or count up from ${b} to ${a}.`,
        tags: { family, digits: 3, carry: a % 10 < b % 10 },
      }
    }
    case 'mul': {
      if (chance(0.55)) {
        const a = rint(12, 99)
        const b = rint(3, 9)
        const t = a - (a % 10)
        return {
          prompt: `${a} × ${b}`,
          answer: a * b,
          how: `Split ${a}: ${t} × ${b} = ${t * b}, ${a % 10} × ${b} = ${(a % 10) * b}, total ${a * b}.`,
          tags: { family, shape: '2x1' },
        }
      }
      const a = rint(11, 39)
      const b = rint(11, 29)
      const bt = b - (b % 10)
      return {
        prompt: `${a} × ${b}`,
        answer: a * b,
        how: `${a} × ${bt} = ${a * bt}, then ${a} × ${b % 10} = ${a * (b % 10)}, total ${a * b}. For a quick check the last digit must be ${(a * b) % 10}.`,
        tags: { family, shape: '2x2' },
      }
    }
    case 'div': {
      const b = rint(3, 19)
      const q = rint(4, 60)
      const tens = Math.floor(q / 10) * 10
      return {
        prompt: `${b * q} ÷ ${b}`,
        answer: q,
        how: tens
          ? `${b} × ${tens} = ${b * tens}, leaving ${b * q - b * tens} = ${b} × ${q - tens}. So ${tens} + ${q - tens} = ${q}.`
          : `What times ${b} is ${b * q}? ${b} × ${q} = ${b * q}, so ${q}.`,
        tags: { family, divisor: b > 9 ? '2 digit' : '1 digit' },
      }
    }
    case 'decimal': {
      const kind = pick(['mul', 'add', 'div'])
      if (kind === 'mul') {
        const a = pick([0.2, 0.25, 0.4, 0.5, 0.75, 1.5, 2.5, 0.1, 0.05, 1.25])
        const b = rint(4, 80)
        const frac: Record<string, string> = {
          '0.2': 'a fifth',
          '0.25': 'a quarter',
          '0.4': 'two fifths',
          '0.5': 'a half',
          '0.75': 'three quarters',
          '1.5': 'one and a half',
          '2.5': 'two and a half',
          '0.1': 'a tenth',
          '0.05': 'a twentieth',
          '1.25': 'one and a quarter',
        }
        return {
          prompt: `${a} × ${b}`,
          answer: round(a * b, 3),
          how: `${a} is ${frac[String(a)]}, so take ${frac[String(a)]} of ${b}: ${f4(a * b)}.`,
          tags: { family, kind },
        }
      }
      if (kind === 'add') {
        const a = round(rint(10, 999) / 10, 1)
        const b = round(rint(10, 999) / 100, 2)
        return {
          prompt: `${a} + ${b}`,
          answer: round(a + b, 2),
          how: `Line up the decimal points: ${a.toFixed(2)} + ${b.toFixed(2)} = ${(a + b).toFixed(2)}. Whole parts ${Math.floor(a)} + ${Math.floor(b)} = ${Math.floor(a) + Math.floor(b)}, then the decimals.`,
          tags: { family, kind },
        }
      }
      const d = pick([0.2, 0.25, 0.5, 0.4, 0.05, 0.1, 0.02, 1.5, 2.5])
      const q = rint(3, 40)
      const recip: Record<string, string> = {
        '0.2': 'multiply by 5',
        '0.25': 'multiply by 4',
        '0.5': 'double',
        '0.4': 'multiply by 2.5',
        '0.05': 'multiply by 20',
        '0.1': 'multiply by 10',
        '0.02': 'multiply by 50',
        '1.5': 'divide by 3 then double',
        '2.5': 'divide by 5 then double',
      }
      return {
        prompt: `${round(d * q, 3)} ÷ ${d}`,
        answer: q,
        how: `Dividing by ${d} is the same as: ${recip[String(d)]}. ${f4(d * q)} becomes ${q}.`,
        tags: { family, kind },
      }
    }
    case 'fraction': {
      const kind = pick(['toDec', 'add', 'ofNumber'])
      if (kind === 'toDec') {
        const d = pick([4, 5, 8, 16, 20, 25, 40, 50])
        const n = rint(1, d - 1)
        return {
          prompt: `${n}/${d} as a decimal`,
          answer: round(n / d, 4),
          how: `1/${d} = ${f4(1 / d)}, so ${n}/${d} = ${n} × ${f4(1 / d)} = ${f4(n / d)}.`,
          tags: { family, kind },
        }
      }
      if (kind === 'add') {
        const d = pick([4, 8, 10, 20])
        const a = rint(1, d - 1)
        const b = rint(1, d - 1)
        return {
          prompt: `${a}/${d} + ${b}/${d} as a decimal`,
          answer: round((a + b) / d, 4),
          how: `Same denominator, so add the tops: ${a + b}/${d}. Then ${a + b} × ${f4(1 / d)} = ${f4((a + b) / d)}.`,
          tags: { family, kind },
        }
      }
      const d = pick([2, 3, 4, 5, 6, 8])
      const n = rint(1, d - 1)
      const x = d * rint(3, 40)
      return {
        prompt: `${n}/${d} of ${x}`,
        answer: (n * x) / d,
        how: `Divide first, then multiply: ${x} ÷ ${d} = ${x / d}, times ${n} = ${(n * x) / d}.`,
        tags: { family, kind },
      }
    }
    case 'percent': {
      const p = pick([5, 10, 12.5, 15, 20, 25, 30, 40, 50, 60, 75, 80, 90])
      const base = pick([20, 40, 60, 80, 120, 160, 200, 240, 300, 320, 400, 480, 600, 800, 1200])
      const ans = round((p * base) / 100, 2)
      const how =
        p === 12.5
          ? `12.5% is an eighth: ${base} ÷ 8 = ${f4(ans)}.`
          : p % 10 === 0
            ? `10% of ${base} is ${f4(base / 10)}, so ${p}% is ${p / 10} × ${f4(base / 10)} = ${f4(ans)}.`
            : `10% of ${base} is ${f4(base / 10)} and 5% is ${f4(base / 20)}: ${p}% = ${Math.floor(p / 10)} × ${f4(base / 10)} + ${f4(base / 20)} = ${f4(ans)}.`
      return { prompt: `${p}% of ${base}`, answer: ans, how, tags: { family, pct: p } }
    }
    case 'square': {
      const n = rint(11, 35)
      const t = n - (n % 10)
      return {
        prompt: `${n}²`,
        answer: n * n,
        how: `(${t} + ${n % 10})² = ${t}² + 2 × ${t} × ${n % 10} + ${n % 10}² = ${t * t} + ${2 * t * (n % 10)} + ${(n % 10) ** 2} = ${n * n}. Squares up to 30 are worth memorising.`,
        tags: { family, size: n > 25 ? 'over 25' : 'up to 25' },
      }
    }
    case 'root': {
      const kind = chance(0.7) ? 'sqrt' : 'cbrt'
      if (kind === 'sqrt') {
        const n = rint(4, 32)
        const lo = Math.floor(n / 10) * 10
        return {
          prompt: `√${n * n}`,
          answer: n,
          how: `${lo}² = ${lo * lo} and ${lo + 10}² = ${(lo + 10) ** 2}, so the root is in the ${lo}s. The last digit of ${n * n} is ${(n * n) % 10}, which only ${n % 10}² ${n % 10 === 0 || n % 10 === 5 ? 'ends in' : 'or ' + (10 - (n % 10)) + '² ends in'}; ${n}² = ${n * n}.`,
          tags: { family, kind },
        }
      }
      const n = rint(2, 12)
      return {
        prompt: `∛${n * n * n}`,
        answer: n,
        how: `Cubes to know: 8, 27, 64, 125, 216, 343, 512, 729, 1000, 1331, 1728. ${n}³ = ${n * n * n}.`,
        tags: { family, kind },
      }
    }
    case 'order': {
      const a = rint(2, 20)
      const b = rint(2, 12)
      const c = rint(2, 12)
      const shape = pick(['a+bc', 'ab-c', 'a-bc', '(a+b)c'])
      if (shape === 'a+bc')
        return {
          prompt: `${a} + ${b} × ${c}`,
          answer: a + b * c,
          how: `Multiply before adding: ${b} × ${c} = ${b * c}, then ${a} + ${b * c} = ${a + b * c}.`,
          tags: { family, shape },
        }
      if (shape === 'ab-c')
        return {
          prompt: `${a} × ${b} − ${c}`,
          answer: a * b - c,
          how: `Multiply first: ${a} × ${b} = ${a * b}, then − ${c} = ${a * b - c}.`,
          tags: { family, shape },
        }
      if (shape === 'a-bc')
        return {
          prompt: `${a * 10} − ${b} × ${c}`,
          answer: a * 10 - b * c,
          how: `Multiply first: ${b} × ${c} = ${b * c}, then ${a * 10} − ${b * c} = ${a * 10 - b * c}.`,
          tags: { family, shape },
        }
      return {
        prompt: `(${a} + ${b}) × ${c}`,
        answer: (a + b) * c,
        how: `Brackets first: ${a} + ${b} = ${a + b}, then × ${c} = ${(a + b) * c}.`,
        tags: { family, shape },
      }
    }
    case 'negative': {
      const kind = pick(['mul', 'add', 'sub'])
      const a = rint(2, 30)
      const b = rint(2, 30)
      if (kind === 'mul')
        return {
          prompt: `−${a} × ${b}`,
          answer: -a * b,
          how: `Negative times positive is negative: ${a} × ${b} = ${a * b}, so −${a * b}.`,
          tags: { family, kind },
        }
      if (kind === 'add')
        return {
          prompt: `−${a} + ${b}`,
          answer: -a + b,
          how: `Start at −${a} and move up ${b}: ${b >= a ? `${b} − ${a} = ${b - a}` : `−(${a} − ${b}) = −${a - b}`}.`,
          tags: { family, kind },
        }
      return {
        prompt: `−${a} − ${b}`,
        answer: -a - b,
        how: `Both negative, so add the sizes and keep the sign: −(${a} + ${b}) = −${a + b}.`,
        tags: { family, kind },
      }
    }
  }
}

function fmt(x: number) {
  return String(round(x, 4))
}

/**
 * Three wrong options built from the mistakes people make: one a slip away
 * (off by one, or one unit in the last place), one a carry or digit error
 * away, one a magnitude or sign error away. Mixed tiers keep the options
 * from being a cluster of near-identical numbers.
 */
function distractors(answer: number): number[] {
  const isDec = !Number.isInteger(answer)
  const places = isDec ? Math.min(4, (String(answer).split('.')[1] ?? '').length) : 0
  const unit = 10 ** -places
  const ok = (x: number) => Number.isFinite(x) && round(x, 4) !== answer
  const tier1 = [answer + unit, answer - unit, answer + 2 * unit, answer - 2 * unit].filter(ok)
  const tier2: number[] = [answer + 10 * unit, answer - 10 * unit]
  if (Math.abs(answer) >= 100 * unit) tier2.push(answer + 100 * unit, answer - 100 * unit)
  const s = String(Math.abs(answer)).replace('.', '')
  if (s.length >= 2 && !isDec) {
    const i = rint(0, s.length - 2)
    if (s[i] !== s[i + 1]) tier2.push(Math.sign(answer) * Number(s.slice(0, i) + s[i + 1] + s[i] + s.slice(i + 2)))
  }
  const tier3: number[] = [answer * 2, answer / 2, answer * 10, answer / 10].filter((x) => isDec || Number.isInteger(x))
  if (answer !== 0) tier3.push(-answer)
  const picks: number[] = []
  for (const tier of [tier1, tier2, tier3]) {
    const cands = shuffle(tier.map((x) => round(x, 4)).filter((x) => ok(x) && !picks.includes(x)))
    if (cands.length) picks.push(cands[0])
  }
  // Top up from the nearest tier if one was empty.
  const pool = shuffle([...tier1, ...tier2, ...tier3].map((x) => round(x, 4)).filter((x) => ok(x) && !picks.includes(x)))
  while (picks.length < 3 && pool.length) picks.push(pool.pop()!)
  return picks.slice(0, 3)
}

function next(c: EightyConfig, prev?: Item): Item {
  const fams = c.families.length ? c.families : ALL_QFAMILIES
  let family = pick(fams)
  if (prev && fams.length > 1 && family === prev.kind && chance(0.6)) family = pick(fams.filter((f) => f !== family))
  const q = gen(family)
  const wrong = distractors(q.answer)
  while (wrong.length < 3) wrong.push(q.answer + wrong.length + 3)
  const opts = shuffle([q.answer, ...wrong])
  return {
    kind: family,
    prompt: q.prompt,
    answer: fmt(q.answer),
    options: opts.map(fmt),
    correctIndex: opts.indexOf(q.answer),
    how: q.how,
    tags: { ...q.tags, negative: q.answer < 0, decimal: !Number.isInteger(q.answer) },
  }
}

function Settings({ cfg, setCfg }: { cfg: EightyConfig; setCfg: (f: (c: EightyConfig) => EightyConfig) => void }) {
  return (
    <>
      <Setting title="Size" note="Questions and minutes, one a minute on average. The classic is 80 in 8.">
        <Seg
          options={[40, 80, 120] as const}
          value={cfg.size}
          onChange={(s) => setCfg((c) => ({ ...c, size: s }))}
          label="Size"
          format={(s) => `${s} in ${s / 10}`}
        />
      </Setting>
      <Setting
        title="Answers"
        note="Typed: no options to lean on, one try, Enter submits and an empty Enter skips. Options: four choices with keys 1 to 4, the format of the real test."
      >
        <Seg
          options={['typed', 'choice'] as const}
          value={cfg.answer}
          onChange={(a) => setCfg((c) => ({ ...c, answer: a }))}
          label="Answers"
          format={(a) => (a === 'typed' ? 'Typed' : 'Four options')}
        />
      </Setting>
      <Setting title="Wrong answer" note="Optiver takes one away. Skipping is always free, with Enter.">
        <Seg
          options={[0, 1, 2] as const}
          value={cfg.penalty}
          onChange={(p) => setCfg((c) => ({ ...c, penalty: p }))}
          label="Penalty"
          format={(p) => (p === 0 ? 'No penalty' : `Minus ${p}`)}
        />
      </Setting>
      <Setting title="Question types">
        <Chips
          options={ALL_QFAMILIES}
          value={cfg.families}
          onToggle={(f) => setCfg((c) => ({ ...c, families: toggleIn(c.families, f) }))}
          labels={FAMILY_LABEL}
        />
      </Setting>
    </>
  )
}

export const eightySpec: TypedSpec<EightyConfig> = {
  id: 'eighty-in-eight',
  title: '80 in 8',
  blurb:
    'Eighty questions, eight minutes. Plus one for right, minus one for wrong, nothing for a skip. Typed answers by default; switch to four options for the format of the real test.',
  mode: (c) => c.answer,
  defaults: { size: 80, penalty: 1, families: [...ALL_QFAMILIES], answer: 'typed' },
  configKey: (c) =>
    `e8:${c.size}:p${c.penalty}:${c.answer === 'typed' ? 'typed' : 'mc'}:${ALL_QFAMILIES.filter((f) => c.families.includes(f)).join(',')}`,
  describe: (c) =>
    `${c.size} in ${c.size / 10}, ${c.answer === 'typed' ? 'typed' : 'four options'}, ${c.penalty === 0 ? 'no penalty' : `minus ${c.penalty}`}${c.families.length === ALL_QFAMILIES.length ? '' : `, ${c.families.length} types`}`,
  submitOnEnter: true,
  oneShot: true,
  inputPattern: /[^\d.-]/g,
  duration: (c) => (c.size / 10) * 60,
  limit: (c) => c.size,
  next,
  Settings,
  points: (c) => ({ right: 1, wrong: -c.penalty }),
  unit: ' pts',
  breakdowns: [
    {
      title: 'By question type',
      key: (e) => FAMILY_LABEL[(e.tags?.family as QFamily) ?? 'addsub'] ?? null,
      order: ALL_QFAMILIES.map((f) => FAMILY_LABEL[f]),
    },
  ],
  colour: (e) => (e.correct ? 'var(--blue-2)' : 'var(--wrong)'),
}
