import { chance, pick, rint, round, shuffle } from '../../../lib/random'
import { durationLabel } from '../../../lib/config'
import { Chips, Seg, Setting, toggleIn } from '../../shared/Frames'
import type { Item, TypedSpec } from '../spec'

/**
 * Mental tricks: the handful of shortcuts that make interview arithmetic
 * fast. Each family is one trick, and every approach in the review names
 * it, so a slow family tells you which trick to drill.
 */
export type Trick = 'square' | 'near100' | 'diffSquares' | 'times11' | 'end5' | 'bigMinus' | 'div5' | 'pct' | 'times25'
export const TRICK_LABEL: Record<Trick, string> = {
  square: 'Two-digit squares',
  near100: 'Products near 100',
  diffSquares: 'Difference of squares',
  times11: 'Times 11',
  end5: 'Squares ending in 5',
  bigMinus: 'Subtract from a round number',
  div5: 'Divide by 5, 25, 50',
  pct: 'Awkward percentages',
  times25: 'Multiply by 25, 50, 75',
}
export const ALL_TRICKS: Trick[] = ['square', 'near100', 'diffSquares', 'times11', 'end5', 'bigMinus', 'div5', 'pct', 'times25']

export interface TricksConfig {
  durationSec: 60 | 120 | 180 | 300
  tricks: Trick[]
  level: 1 | 2 | 3
}
const DURATIONS = [60, 120, 180, 300] as const
const s = (x: number) => String(round(x, 4))

function build(t: Trick, L: number): { prompt: string; answer: number; how: string; tags: Record<string, string | number | boolean> } {
  switch (t) {
    case 'square': {
      const n = rint(L === 1 ? 11 : 21, L === 1 ? 29 : L === 2 ? 59 : 99)
      const tens = n - (n % 10)
      const u = n % 10
      const near = u >= 6 ? tens + 10 : tens
      const d = n - near
      return {
        prompt: `${n}²`,
        answer: n * n,
        how: `Use (a + d)² = a² + 2ad + d² with a round a: ${near}² = ${near * near}, 2 × ${near} × ${d} = ${2 * near * d}, ${d}² = ${d * d}. Total ${n * n}. Or the pairing trick: ${n}² = ${n + (u >= 5 ? 10 - u : -u)} × ${n - (u >= 5 ? 10 - u : -u)} + ${(u >= 5 ? 10 - u : u) ** 2} = ${(n + (u >= 5 ? 10 - u : -u)) * (n - (u >= 5 ? 10 - u : -u))} + ${(u >= 5 ? 10 - u : u) ** 2}.`,
        tags: { trick: t, size: n < 30 ? 'under 30' : n < 60 ? '30 to 59' : '60 and up' },
      }
    }
    case 'near100': {
      const a = 100 + (chance(0.5) ? -1 : 1) * rint(1, L === 1 ? 6 : L === 2 ? 12 : 20)
      const b = 100 + (chance(0.5) ? -1 : 1) * rint(1, L === 1 ? 6 : L === 2 ? 12 : 20)
      const da = a - 100
      const db = b - 100
      return {
        prompt: `${a} × ${b}`,
        answer: a * b,
        how: `Write each as 100 plus a difference: ${da >= 0 ? '+' : ''}${da} and ${db >= 0 ? '+' : ''}${db}. The product is 100 × (100 ${da + db >= 0 ? '+' : '−'} ${Math.abs(da + db)}) + (${da})(${db}) = ${100 * (100 + da + db)} ${da * db >= 0 ? '+' : '−'} ${Math.abs(da * db)} = ${a * b}. The first part is just ${a} ${db >= 0 ? '+' : '−'} ${Math.abs(db)} = ${a + db}, then two zeros.`,
        tags: { trick: t, sameSide: Math.sign(da) === Math.sign(db) },
      }
    }
    case 'diffSquares': {
      const m = pick(
        L === 1
          ? [20, 30, 40, 50, 60]
          : L === 2
            ? [25, 30, 35, 40, 45, 50, 60, 70, 80]
            : [30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 90, 95],
      )
      const d = rint(1, L === 1 ? 2 : L === 2 ? 4 : 7)
      return {
        prompt: `${m - d} × ${m + d}`,
        answer: m * m - d * d,
        how: `Both numbers sit ${d} either side of ${m}, so the product is ${m}² − ${d}² = ${m * m} − ${d * d} = ${m * m - d * d}.`,
        tags: { trick: t, gap: d <= 2 ? 'gap 1 to 2' : 'gap 3 and up' },
      }
    }
    case 'times11': {
      const n = L === 1 ? rint(12, 89) : L === 2 ? rint(45, 99) : rint(101, 989)
      const digits = String(n).split('').map(Number)
      const sums = digits.slice(1).map((d, i) => digits[i] + d)
      return {
        prompt: `${n} × 11`,
        answer: n * 11,
        how: `Keep the outer digits and add neighbours between them: ${digits.join(' ')} gives ${digits[0]} | ${sums.join(' | ')} | ${digits[digits.length - 1]}${sums.some((x) => x >= 10) ? ', carrying where a pair reaches 10' : ''}: ${n * 11}. Same as ${n} × 10 + ${n} = ${n * 10} + ${n}.`,
        tags: { trick: t, carry: sums.some((x) => x >= 10), digits: digits.length },
      }
    }
    case 'end5': {
      const tens = rint(1, L === 1 ? 7 : L === 2 ? 12 : 19)
      const n = tens * 10 + 5
      return {
        prompt: `${n}²`,
        answer: n * n,
        how: `A number ending in 5: multiply the tens digit${tens >= 10 ? 's' : ''} ${tens} by the next number ${tens + 1} = ${tens * (tens + 1)}, then write 25 after it: ${n * n}.`,
        tags: { trick: t, size: n < 100 ? 'two digit' : 'three digit' },
      }
    }
    case 'bigMinus': {
      const big = pick(L === 1 ? [1000, 10000] : L === 2 ? [10000, 100000] : [100000, 1000000])
      const sub = rint(big / 100, big / 2)
      const digits = String(sub)
      const comp = digits
        .split('')
        .map((d, i) => (i === digits.length - 1 ? 10 - Number(d) : 9 - Number(d)))
        .join('')
      return {
        prompt: `${big.toLocaleString('en-US')} − ${sub.toLocaleString('en-US')}`,
        answer: big - sub,
        how: `Take every digit of ${sub} from 9 and the last one from 10 (the complement): ${digits.split('').join(' ')} becomes ${comp.split('').join(' ')}, so ${big - sub}. No borrowing.`,
        tags: { trick: t, zeros: String(big).length - 1 },
      }
    }
    case 'div5': {
      const d = pick(L === 1 ? [5] : L === 2 ? [5, 25] : [5, 25, 50])
      const q = rint(L === 1 ? 10 : 20, L === 1 ? 200 : L === 2 ? 600 : 2000)
      const n = d * q
      const how =
        d === 5
          ? `Dividing by 5 is doubling then dividing by 10: ${n} × 2 = ${n * 2}, shift one place: ${q}.`
          : d === 25
            ? `Dividing by 25 is multiplying by 4 then dividing by 100: ${n} × 4 = ${n * 4}, shift two places: ${q}.`
            : `Dividing by 50 is doubling then dividing by 100: ${n} × 2 = ${n * 2}, shift two places: ${q}.`
      return { prompt: `${n} ÷ ${d}`, answer: q, how, tags: { trick: t, divisor: d } }
    }
    case 'pct': {
      const p = pick(
        L === 1
          ? [15, 35, 45, 55, 65, 85]
          : L === 2
            ? [12, 14, 16, 18, 22, 24, 28, 32, 36, 38, 42, 44, 46, 48, 54, 56, 58]
            : [
                13, 17, 19, 21, 23, 27, 29, 31, 33, 37, 39, 41, 43, 47, 49, 51, 53, 57, 59, 61, 63, 67, 69, 71, 73, 77, 79, 81, 83, 87, 89,
                91, 93, 97,
              ],
      )
      const base = pick([20, 40, 50, 60, 80, 110, 120, 150, 160, 180, 200, 220, 240, 250, 300, 320, 350, 400, 450, 480, 500])
      const ans = round((p * base) / 100, 2)
      return {
        prompt: `${p}% of ${base}`,
        answer: ans,
        how: `Swap if it helps: ${p}% of ${base} is ${base}% of ${p}, which is ${s(base / 100)} × ${p} = ${s(ans)}. Or split: ${Math.floor(p / 10) * 10}% of ${base} is ${s((Math.floor(p / 10) * 10 * base) / 100)} and ${p % 10}% is ${s(((p % 10) * base) / 100)}, total ${s(ans)}.`,
        tags: { trick: t, decimals: Number.isInteger(ans) ? 0 : 1 },
      }
    }
    case 'times25': {
      const m = pick(L === 1 ? [25, 50] : [25, 50, 75])
      const n = rint(L === 1 ? 12 : 24, L === 1 ? 99 : L === 2 ? 240 : 999)
      const how =
        m === 25
          ? `Multiplying by 25 is multiplying by 100 then dividing by 4: ${n}00 ÷ 4 = ${n * 25}.`
          : m === 50
            ? `Multiplying by 50 is multiplying by 100 then halving: ${n}00 ÷ 2 = ${n * 50}.`
            : `Multiplying by 75 is three quarters of ${n}00: ${n}00 ÷ 4 = ${n * 25}, times 3 = ${n * 75}.`
      return { prompt: `${n} × ${m}`, answer: n * m, how, tags: { trick: t, factor: m } }
    }
  }
}

function next(c: TricksConfig, prev?: Item): Item {
  const ts = c.tricks.length ? c.tricks : ALL_TRICKS
  let t = pick(ts)
  if (prev && ts.length > 1 && t === prev.kind && chance(0.6)) t = pick(ts.filter((x) => x !== t))
  const b = build(t, c.level)
  return {
    kind: t,
    prompt: b.prompt,
    answer: s(b.answer),
    how: b.how,
    tags: { ...b.tags, level: c.level, digits: String(Math.round(Math.abs(b.answer))).length },
  }
}

function Settings({ cfg, setCfg }: { cfg: TricksConfig; setCfg: (f: (c: TricksConfig) => TricksConfig) => void }) {
  return (
    <>
      <Setting title="Clock">
        <Seg
          options={DURATIONS}
          value={cfg.durationSec}
          onChange={(d) => setCfg((c) => ({ ...c, durationSec: d }))}
          label="Duration"
          format={durationLabel}
        />
      </Setting>
      <Setting title="Level" note="Level 1 keeps the numbers small. Level 3 goes to three digits and the harder percentages.">
        <Seg options={[1, 2, 3] as const} value={cfg.level} onChange={(l) => setCfg((c) => ({ ...c, level: l }))} label="Level" />
      </Setting>
      <Setting title="Tricks" note="Each family is one shortcut. The review names the trick for every slip.">
        <Chips
          options={ALL_TRICKS}
          value={cfg.tricks}
          onToggle={(t) => setCfg((c) => ({ ...c, tricks: toggleIn(c.tricks, t) }))}
          labels={TRICK_LABEL}
        />
        <div className="chips chips--actions">
          <button className="btn btn-ghost btn-small" onClick={() => setCfg((c) => ({ ...c, tricks: [...ALL_TRICKS] }))}>
            All
          </button>
          <button className="btn btn-ghost btn-small" onClick={() => setCfg((c) => ({ ...c, tricks: shuffle(ALL_TRICKS).slice(0, 3) }))}>
            Random three
          </button>
        </div>
      </Setting>
    </>
  )
}

export const tricksSpec: TypedSpec<TricksConfig> = {
  id: 'tricks',
  title: 'Mental tricks',
  blurb:
    'Nine shortcuts, one per family: squares, products near 100, difference of squares, times 11, round-number subtraction, awkward percentages. Type the number only.',
  mode: 'typed',
  defaults: { durationSec: 120, tricks: [...ALL_TRICKS], level: 2 },
  configKey: (c) => `tr:${c.durationSec}:L${c.level}:${ALL_TRICKS.filter((t) => c.tricks.includes(t)).join(',')}`,
  describe: (c) =>
    `${durationLabel(c.durationSec)}, level ${c.level}, ${c.tricks.length === ALL_TRICKS.length ? 'all tricks' : `${c.tricks.length} tricks`}`,
  duration: (c) => c.durationSec,
  next,
  Settings,
  inputPattern: /[^\d.-]/g,
  breakdowns: [
    {
      title: 'By trick',
      key: (e) => TRICK_LABEL[(e.tags?.trick as Trick) ?? 'square'] ?? null,
      order: ALL_TRICKS.map((t) => TRICK_LABEL[t]),
    },
    {
      title: 'By answer size',
      key: (e) => {
        const d = Number(e.tags?.digits ?? 0)
        return d <= 3 ? 'Up to 3 digits' : d === 4 ? '4 digits' : '5 or more'
      },
      order: ['Up to 3 digits', '4 digits', '5 or more'],
    },
  ],
  colour: (e) => (['square', 'end5', 'diffSquares', 'near100'].includes(String(e.tags?.trick)) ? 'var(--blue-2)' : 'var(--yellow)'),
}
