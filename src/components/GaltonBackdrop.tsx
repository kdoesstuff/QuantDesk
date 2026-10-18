import { useEffect, useRef } from 'react'

/**
 * A faint Galton board that fills the section behind it. Balls fall slowly
 * through pegs and pile up at the bottom. Drawn at low contrast so text on top
 * stays readable. Moving the cursor across the section biases the coin a
 * little. Canvas, capped pixel ratio, pauses when off screen.
 */
export default function GaltonBackdrop({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current!
    const ctx = canvas.getContext('2d')!
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    const fine = matchMedia('(pointer: fine)').matches
    const dpr = Math.min(1.5, window.devicePixelRatio || 1)

    let W = 0
    let H = 0
    let rows = 20
    let BINS = rows + 1
    let pegGap = 44
    let topY = 0
    let binBottom = 0
    let cx = 0
    let counts: number[] = []
    let total = 0

    interface Ball {
      row: number
      col: number
      t: number
      dir: -1 | 1
      binning: boolean
      y: number
    }
    const balls: Ball[] = []
    let p = 0.5
    let pTarget = 0.5

    const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim()

    const layout = () => {
      W = canvas.clientWidth || 1
      H = canvas.clientHeight || 1
      canvas.width = Math.round(W * dpr)
      canvas.height = Math.round(H * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      // Pegs fill about 70% of the height; the pile takes the rest.
      pegGap = W < 720 ? 30 : 44
      rows = Math.max(8, Math.min(40, Math.floor((H - 260) / pegGap)))
      // Never wider than the section.
      while ((rows + 2) * pegGap > W * 0.96 && pegGap > 18) pegGap -= 2
      BINS = rows + 1
      cx = W / 2
      topY = H * 0.06
      binBottom = H - 10
      if (counts.length !== BINS) {
        counts = new Array<number>(BINS).fill(0)
        total = 0
        balls.length = 0
        // Start with a shape already present
        for (let i = 0; i < 260; i++) {
          let c = 0
          for (let r = 0; r < rows; r++) if (Math.random() < 0.5) c++
          counts[c]++
          total++
        }
      }
    }
    const pegX = (row: number, col: number) => cx + (col - row / 2) * pegGap
    const pegY = (row: number) => topY + row * pegGap
    const binX = (i: number) => cx + (i - rows / 2) * pegGap

    const draw = () => {
      const blue = css('--blue-2')
      const yellow = css('--yellow')
      const ink3 = css('--ink-3')

      ctx.clearRect(0, 0, W, H)

      // Pegs, faint
      ctx.fillStyle = ink3
      ctx.globalAlpha = 0.28
      const pr = Math.max(1.4, pegGap * 0.055)
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c <= r; c++) {
          ctx.beginPath()
          ctx.arc(pegX(r, c), pegY(r), pr, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      // Pile, faint
      const binTop = pegY(rows) + pegGap * 0.6
      const binH = Math.max(40, Math.min(220, binBottom - binTop))
      const maxCount = Math.max(6, ...counts)
      const bw = pegGap - Math.max(3, pegGap * 0.24)
      ctx.fillStyle = blue
      ctx.globalAlpha = 0.22
      for (let i = 0; i < BINS; i++) {
        const h = (counts[i] / maxCount) * binH
        if (h <= 0) continue
        ctx.fillRect(binX(i) - bw / 2, binBottom - h, bw, h)
      }

      // Balls, a little brighter than the rest
      const rad = Math.max(2.2, pegGap * 0.11)
      ctx.globalAlpha = 0.55
      for (const b of balls) {
        let x: number
        let y: number
        if (!b.binning) {
          const x0 = pegX(b.row, b.col)
          const x1 = pegX(b.row + 1, b.col + (b.dir === 1 ? 1 : 0))
          const y0 = pegY(b.row)
          const y1 = pegY(b.row + 1)
          const e = b.t
          x = x0 + (x1 - x0) * e
          y = y0 + (y1 - y0) * (e * e) - Math.sin(e * Math.PI) * pegGap * 0.2
        } else {
          x = binX(b.col)
          y = b.y
        }
        ctx.fillStyle = b.row % 7 === 3 && !b.binning ? yellow : blue
        ctx.beginPath()
        ctx.arc(x, y, rad, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
    }

    let raf = 0
    let last = performance.now()
    let acc = 0
    let visible = true

    const step = (now: number) => {
      raf = 0
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      p += (pTarget - p) * (1 - Math.exp(-dt * 2))

      acc += dt
      while (acc > 0.22 && balls.length < 40) {
        acc -= 0.22
        balls.push({ row: 0, col: 0, t: 0, dir: Math.random() < p ? 1 : -1, binning: false, y: 0 })
      }

      const binTop = pegY(rows) + pegGap * 0.6
      const binH = Math.max(40, Math.min(220, binBottom - binTop))
      for (let i = balls.length - 1; i >= 0; i--) {
        const b = balls[i]
        if (!b.binning) {
          b.t += dt * 4.2
          if (b.t >= 1) {
            b.t = 0
            b.col += b.dir === 1 ? 1 : 0
            b.row += 1
            b.dir = Math.random() < p ? 1 : -1
            if (b.row >= rows) {
              b.binning = true
              b.y = pegY(rows)
            }
          }
        } else {
          b.y += dt * 420
          const maxCount = Math.max(6, ...counts)
          const h = (counts[b.col] / maxCount) * binH
          if (b.y >= binBottom - h - 3) {
            counts[b.col]++
            total++
            balls.splice(i, 1)
          }
        }
      }
      if (total > 1600) {
        for (let i = 0; i < BINS; i++) counts[i] = Math.round(counts[i] * 0.5)
        total = counts.reduce((a, c) => a + c, 0)
      }

      draw()
      if (visible && !document.hidden) schedule()
    }
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(step)
    }

    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect()
      if (e.clientY < r.top || e.clientY > r.bottom) {
        pTarget = 0.5
        return
      }
      const u = (e.clientX - r.left) / r.width
      const d = Math.max(-1, Math.min(1, (u - 0.5) / 0.4))
      pTarget = 0.5 + d * 0.16
    }
    const onLeave = () => {
      pTarget = 0.5
    }

    layout()
    if (reduce) {
      draw()
    } else {
      schedule()
      if (fine) {
        window.addEventListener('pointermove', onMove, { passive: true })
        document.addEventListener('pointerleave', onLeave)
      }
    }

    const ro = new ResizeObserver(() => {
      layout()
      draw()
    })
    ro.observe(canvas)
    const io = new IntersectionObserver(([en]) => {
      visible = en.isIntersecting
      if (visible && !reduce) schedule()
    })
    io.observe(canvas)
    const onVis = () => {
      if (!document.hidden && visible && !reduce) schedule()
    }
    document.addEventListener('visibilitychange', onVis)
    const mo = new MutationObserver(draw)
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      io.disconnect()
      mo.disconnect()
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerleave', onLeave)
    }
  }, [])

  return <canvas ref={ref} className={className} aria-hidden="true" />
}
