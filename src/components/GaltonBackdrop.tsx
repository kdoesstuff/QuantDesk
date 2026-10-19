import { useEffect, useRef } from 'react'

/**
 * A faint Galton board that fills the section behind it. The board starts
 * empty. Balls fall through the pegs and the pile grows bin by bin until the
 * bell shape is clearly there, then the pile fades out and the run starts
 * again. Drawn at low contrast so text on top stays readable. Moving the
 * cursor across the section biases the coin a little. Canvas, capped pixel
 * ratio, pauses when off screen.
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
    let rowGap = 44
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

    // Lifecycle of one run. fill: drop balls until the shape is clear.
    // settle: stop dropping, let the ones in flight land. hold: keep the
    // finished shape on screen for a moment. fade: dissolve the pile, then
    // start over.
    type Phase = 'fill' | 'settle' | 'hold' | 'fade'
    let phase: Phase = 'fill'
    let phaseT = 0
    let runT = 0
    let pileAlpha = 1
    // Tallest bin, eased so the pile rescales smoothly as it grows.
    let shownMax = 6

    const SPAWN_EVERY = 0.09
    const IN_FLIGHT = 64
    const HOLD_FOR = 2.4
    const FADE_FOR = 1.4
    const MAX_RUN = 80

    // Enough balls that the bell is unmistakable for this many bins.
    const targetFor = (bins: number) => Math.round(Math.max(240, Math.min(420, bins * 14)))

    const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim()

    const resetRun = () => {
      counts = Array.from({ length: BINS }, () => 0)
      total = 0
      balls.length = 0
      shownMax = 6
      pileAlpha = 1
      phase = 'fill'
      phaseT = 0
      runT = 0
    }

    const layout = () => {
      W = canvas.clientWidth || 1
      H = canvas.clientHeight || 1
      canvas.width = Math.round(W * dpr)
      canvas.height = Math.round(H * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      // The board always fits the width. Rows are spaced a little taller
      // than they are wide so the pegs fill most of the section's height on
      // narrow screens without spilling past its edges.
      pegGap = W < 720 ? 24 : 44
      const byWidth = () => Math.floor((W * 0.96) / pegGap) - 2
      while (byWidth() < 8 && pegGap > 16) pegGap -= 2
      const byHeight = Math.floor((H - 260) / pegGap)
      rows = Math.max(6, Math.min(40, Math.min(byWidth(), byHeight)))
      rowGap = Math.max(pegGap, Math.min(pegGap * 2.2, (H * 0.72) / rows))
      BINS = rows + 1
      cx = W / 2
      topY = H * 0.06
      binBottom = H - 10
      if (counts.length !== BINS) {
        resetRun()
        if (reduce) {
          // No animation: show a finished shape instead of an empty board.
          for (let i = 0; i < targetFor(BINS); i++) {
            let c = 0
            for (let r = 0; r < rows; r++) if (Math.random() < 0.5) c++
            counts[c]++
            total++
          }
          shownMax = Math.max(6, ...counts)
        }
      }
    }
    const pegX = (row: number, col: number) => cx + (col - row / 2) * pegGap
    const pegY = (row: number) => topY + row * rowGap
    const binX = (i: number) => cx + (i - rows / 2) * pegGap
    const pileH = () => {
      const binTop = pegY(rows) + rowGap * 0.6
      return Math.max(40, Math.min(220, binBottom - binTop))
    }
    const barH = (i: number) => (counts[i] / shownMax) * pileH()

    // A bar with a rounded top, so the pile has no hard corners.
    const bar = (x: number, w: number, h: number) => {
      const r = Math.min(w / 2, h)
      ctx.beginPath()
      ctx.moveTo(x, binBottom)
      ctx.lineTo(x, binBottom - h + r)
      ctx.arc(x + r, binBottom - h + r, r, Math.PI, Math.PI * 1.5)
      ctx.lineTo(x + w - r, binBottom - h)
      ctx.arc(x + w - r, binBottom - h + r, r, Math.PI * 1.5, Math.PI * 2)
      ctx.lineTo(x + w, binBottom)
      ctx.closePath()
      ctx.fill()
    }

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

      // Pile, faint. Fades out at the end of a run.
      const bw = pegGap - Math.max(3, pegGap * 0.24)
      ctx.fillStyle = blue
      ctx.globalAlpha = 0.26 * pileAlpha
      for (let i = 0; i < BINS; i++) {
        const h = barH(i)
        if (h <= 0.5) continue
        bar(binX(i) - bw / 2, bw, h)
      }

      // Balls, a little brighter than the rest
      const rad = Math.max(2.2, pegGap * 0.11)
      ctx.globalAlpha = 0.55 * pileAlpha
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
          y = y0 + (y1 - y0) * (e * e) - Math.sin(e * Math.PI) * rowGap * 0.2
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
      phaseT += dt
      runT += dt

      // Drop balls only while filling.
      if (phase === 'fill') {
        acc += dt
        while (acc > SPAWN_EVERY && balls.length < IN_FLIGHT) {
          acc -= SPAWN_EVERY
          balls.push({ row: 0, col: 0, t: 0, dir: Math.random() < p ? 1 : -1, binning: false, y: 0 })
        }
        if (total >= targetFor(BINS) || runT > MAX_RUN) {
          phase = 'settle'
          phaseT = 0
        }
      } else {
        acc = 0
      }

      // Ease the pile scale toward the real tallest bin.
      const maxCount = Math.max(6, ...counts)
      shownMax += (maxCount - shownMax) * (1 - Math.exp(-dt * 4))

      const ph = pileH()
      const fall = Math.max(420, (binBottom - pegY(rows)) / 2.4)
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
          b.y += dt * fall
          // Land on top of this bin's bar, so the ball visibly joins the pile.
          const h = (counts[b.col] / shownMax) * ph
          if (b.y >= binBottom - h - 2) {
            counts[b.col]++
            total++
            balls.splice(i, 1)
          }
        }
      }

      if (phase === 'settle' && balls.length === 0) {
        phase = 'hold'
        phaseT = 0
      } else if (phase === 'hold' && phaseT >= HOLD_FOR) {
        phase = 'fade'
        phaseT = 0
      } else if (phase === 'fade') {
        const u = Math.min(1, phaseT / FADE_FOR)
        pileAlpha = 1 - u * u * (3 - 2 * u)
        if (u >= 1) resetRun()
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
      if (visible && !reduce) {
        // Do not count time spent off screen.
        last = performance.now()
        schedule()
      }
    })
    io.observe(canvas)
    const onVis = () => {
      if (!document.hidden && visible && !reduce) {
        last = performance.now()
        schedule()
      }
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
