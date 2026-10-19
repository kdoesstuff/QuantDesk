import { useEffect, useRef } from 'react'

/**
 * A living Galton board. Balls fall through a triangle of pegs, bouncing left
 * or right with equal probability, and pile up into a binomial that converges
 * on the normal curve drawn behind it. Click to drop a handful at once.
 */
interface Ball {
  row: number // index of peg row we're falling from
  col: number // horizontal peg index at that row (0..row)
  t: number // 0..1 progress to next row
  dir: -1 | 1
  warm: boolean
  // once past the last row: falling into bin
  binning: boolean
  y: number
}

const ROWS = 12
const BINS = ROWS + 1

export default function GaltonBoard({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current!
    const ctx = canvas.getContext('2d')!
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches

    const W = 440
    const H = 540
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = W * dpr
    canvas.height = H * dpr
    canvas.style.width = '100%'
    canvas.style.aspectRatio = `${W} / ${H}`
    ctx.scale(dpr, dpr)

    const pegGap = 28
    const topY = 70
    const pegX = (row: number, col: number) => W / 2 + (col - row / 2) * pegGap
    const pegY = (row: number) => topY + row * pegGap
    const binTop = pegY(ROWS) + 30
    const binBottom = H - 18
    const binW = pegGap
    const binX = (i: number) => W / 2 + (i - ROWS / 2) * binW

    const counts = Array.from({ length: BINS }, () => 0)
    let total = 0
    const balls: Ball[] = []
    let dropAcc = 0
    let last = performance.now()
    let raf = 0

    const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim()

    function spawn(warm = false) {
      balls.push({ row: 0, col: 0, t: 0, dir: Math.random() < 0.5 ? -1 : 1, warm, binning: false, y: pegY(0) })
    }

    // Pre-fill in reduced-motion so the picture is still meaningful.
    if (reduce) {
      for (let i = 0; i < 600; i++) {
        let c = 0
        for (let r = 0; r < ROWS; r++) if (Math.random() < 0.5) c++
        counts[c]++
        total++
      }
    }

    function draw() {
      const cobalt = css('--blue-2')
      const marigold = css('--yellow')
      const peg = css('--ink-3')
      const rule = css('--ground-3')
      const ink2 = css('--ink-2')

      ctx.clearRect(0, 0, W, H)

      // Funnel at top
      ctx.strokeStyle = rule
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(W / 2 - 34, 18)
      ctx.lineTo(W / 2 - 6, 52)
      ctx.moveTo(W / 2 + 34, 18)
      ctx.lineTo(W / 2 + 6, 52)
      ctx.stroke()

      // Pegs
      ctx.fillStyle = peg
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c <= r; c++) {
          ctx.beginPath()
          ctx.arc(pegX(r, c), pegY(r), 2.2, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      // Normal curve (expected shape) behind the bins, drawn only once there is a shape to compare to
      const maxCount = Math.max(8, ...counts)
      const binH = binBottom - binTop
      if (total >= 24) {
        ctx.strokeStyle = ink2
        ctx.globalAlpha = 0.35
        ctx.lineWidth = 1.2
        ctx.setLineDash([3, 4])
        ctx.beginPath()
        const n = ROWS
        const p = 0.5
        const mean = n * p
        const sd = Math.sqrt(n * p * (1 - p))
        for (let x = 0; x <= BINS * 8; x++) {
          const k = x / 8 // continuous bin index
          const expected = (total * Math.exp(-0.5 * ((k - mean) / sd) ** 2)) / (sd * Math.sqrt(2 * Math.PI))
          const y = binBottom - (expected / maxCount) * binH
          const px = binX(k)
          if (x === 0) ctx.moveTo(px, y)
          else ctx.lineTo(px, y)
        }
        ctx.stroke()
        ctx.setLineDash([])
        ctx.globalAlpha = 1
      }

      // Bins
      for (let i = 0; i < BINS; i++) {
        const h = (counts[i] / maxCount) * binH
        const x = binX(i) - binW / 2 + 3
        ctx.fillStyle = cobalt
        ctx.globalAlpha = 0.9
        const r = 3
        const y = binBottom - h
        ctx.beginPath()
        ctx.moveTo(x, binBottom)
        ctx.lineTo(x, y + r)
        ctx.quadraticCurveTo(x, y, x + r, y)
        ctx.lineTo(x + binW - 6 - r, y)
        ctx.quadraticCurveTo(x + binW - 6, y, x + binW - 6, y + r)
        ctx.lineTo(x + binW - 6, binBottom)
        ctx.closePath()
        ctx.fill()
        ctx.globalAlpha = 1
      }

      // Baseline
      ctx.strokeStyle = rule
      ctx.beginPath()
      ctx.moveTo(binX(0) - binW / 2, binBottom + 0.5)
      ctx.lineTo(binX(BINS - 1) + binW / 2, binBottom + 0.5)
      ctx.stroke()

      // Balls
      for (const b of balls) {
        let x: number, y: number
        if (!b.binning) {
          const x0 = pegX(b.row, b.col)
          const x1 = pegX(b.row + 1, b.col + (b.dir === 1 ? 1 : 0))
          const y0 = pegY(b.row)
          const y1 = pegY(b.row + 1)
          const e = b.t
          x = x0 + (x1 - x0) * e
          // small arc: rise slightly then fall
          y = y0 + (y1 - y0) * (e * e) - Math.sin(e * Math.PI) * 6
        } else {
          x = binX(b.col)
          y = b.y
        }
        ctx.fillStyle = b.warm ? marigold : cobalt
        ctx.beginPath()
        ctx.arc(x, y, 4.2, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    function step(now: number) {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now

      dropAcc += dt
      const interval = 0.26
      while (dropAcc > interval && balls.length < 40) {
        dropAcc -= interval
        spawn(Math.random() < 0.12)
      }

      for (let i = balls.length - 1; i >= 0; i--) {
        const b = balls[i]
        if (!b.binning) {
          b.t += dt * 5.2
          if (b.t >= 1) {
            b.t = 0
            b.col += b.dir === 1 ? 1 : 0
            b.row += 1
            b.dir = Math.random() < 0.5 ? -1 : 1
            if (b.row >= ROWS) {
              b.binning = true
              b.y = pegY(ROWS)
            }
          }
        } else {
          b.y += dt * 520
          const maxCount = Math.max(8, ...counts)
          const h = (counts[b.col] / maxCount) * (binBottom - binTop)
          if (b.y >= binBottom - h - 4) {
            counts[b.col]++
            total++
            balls.splice(i, 1)
          }
        }
      }

      // Keep it endless: after a lot of balls, gently decay the histogram so
      // the shape stays readable instead of saturating.
      if (total > 900) {
        for (let i = 0; i < BINS; i++) counts[i] = Math.round(counts[i] * 0.5)
        total = counts.reduce((a, c) => a + c, 0)
      }

      draw()
      raf = requestAnimationFrame(step)
    }

    const onClick = () => {
      for (let i = 0; i < 18; i++) setTimeout(() => spawn(i % 5 === 0), i * 40)
    }
    canvas.addEventListener('click', onClick)

    if (reduce) {
      draw()
    } else {
      raf = requestAnimationFrame(step)
    }

    // Redraw on theme change (colours are read from CSS variables).
    const obs = new MutationObserver(() => draw())
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })

    return () => {
      cancelAnimationFrame(raf)
      canvas.removeEventListener('click', onClick)
      obs.disconnect()
    }
  }, [])

  return (
    <canvas ref={ref} className={className} role="img" aria-label="A Galton board: balls fall through pegs and pile into a bell curve" />
  )
}
