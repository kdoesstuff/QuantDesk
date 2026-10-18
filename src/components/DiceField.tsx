import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'

/**
 * A field of dice and coins floating in studio light. They drift and tumble on
 * their own, lean toward the cursor as a group, and individually move out of
 * the cursor's way before springing home. Built to stay smooth: capped pixel
 * ratio, no shadows, a handful of meshes, and it stops rendering off-screen.
 */

type Kind = 'die' | 'coin'

interface Body {
  mesh: THREE.Mesh
  kind: Kind
  home: THREE.Vector3
  pos: THREE.Vector3
  vel: THREE.Vector3
  spin: THREE.Vector3
  phase: number
  bob: number
  scale: number
}

const PIP_LAYOUT: Record<number, [number, number][]> = {
  1: [[0.5, 0.5]],
  2: [[0.25, 0.25], [0.75, 0.75]],
  3: [[0.25, 0.25], [0.5, 0.5], [0.75, 0.75]],
  4: [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]],
  5: [[0.25, 0.25], [0.75, 0.25], [0.5, 0.5], [0.25, 0.75], [0.75, 0.75]],
  6: [[0.25, 0.2], [0.75, 0.2], [0.25, 0.5], [0.75, 0.5], [0.25, 0.8], [0.75, 0.8]],
}

function pipTexture(n: number, body: string, pip: string) {
  const s = 256
  const c = document.createElement('canvas')
  c.width = s
  c.height = s
  const g = c.getContext('2d')!
  g.fillStyle = body
  g.fillRect(0, 0, s, s)
  g.fillStyle = pip
  for (const [x, y] of PIP_LAYOUT[n]) {
    g.beginPath()
    g.arc(x * s, y * s, s * 0.085, 0, Math.PI * 2)
    g.fill()
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

function dieMaterials(body: string, pip: string) {
  // Opposite faces sum to 7: +x 1, -x 6, +y 2, -y 5, +z 3, -z 4
  const faces = [1, 6, 2, 5, 3, 4]
  return faces.map(
    (n) =>
      new THREE.MeshStandardMaterial({
        map: pipTexture(n, body, pip),
        roughness: 0.42,
        metalness: 0.08,
      }),
  )
}

function cssVar(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

export default function DiceField({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const host = ref.current!
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    const finePointer = matchMedia('(pointer: fine)').matches

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
    renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1))
    renderer.setClearColor(0x000000, 0)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.05
    host.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100)
    camera.position.set(0, 0, 11)

    // Light: one warm key from upper left, a cool rim from the right, soft fill.
    scene.add(new THREE.HemisphereLight(0xffffff, 0x1a2030, 0.55))
    const key = new THREE.DirectionalLight(0xfff2d6, 2.1)
    key.position.set(-4, 6, 6)
    scene.add(key)
    const rim = new THREE.DirectionalLight(0x6f88ff, 1.6)
    rim.position.set(6, -2, -3)
    scene.add(rim)
    const fill = new THREE.DirectionalLight(0xffffff, 0.35)
    fill.position.set(2, -4, 5)
    scene.add(fill)

    const group = new THREE.Group()
    scene.add(group)

    // Palette from CSS so the theme toggle recolours the objects.
    let inkBody = '#1c2230'
    let blue = '#0a21c0'
    let yellow = '#faed26'
    const readPalette = () => {
      const theme = document.documentElement.dataset.theme
      blue = cssVar('--blue-deep') || blue
      yellow = cssVar('--yellow') || yellow
      inkBody = theme === 'light' ? '#f6f3ea' : '#2a3242'
    }
    readPalette()

    const dieGeo = new RoundedBoxGeometry(1, 1, 1, 5, 0.13)
    const coinGeo = new THREE.CylinderGeometry(0.62, 0.62, 0.14, 48)

    const bodies: Body[] = []
    const rnd = (a: number, b: number) => a + Math.random() * (b - a)

    // Layout: biased to the right so the headline owns the left.
    const spec: { kind: Kind; x: number; y: number; z: number; s: number; tint: 'ink' | 'blue' | 'yellow' }[] = [
      { kind: 'die', x: 4.2, y: 2.7, z: 0.2, s: 1.15, tint: 'ink' },
      { kind: 'die', x: 2.6, y: -2.1, z: 0.9, s: 1.15, tint: 'blue' },
      { kind: 'die', x: 6.3, y: -0.6, z: -0.4, s: 1.0, tint: 'ink' },
      { kind: 'die', x: 5.9, y: 0.9, z: -1.8, s: 0.75, tint: 'ink' },
      { kind: 'die', x: 5.4, y: -2.8, z: -1.0, s: 0.8, tint: 'yellow' },
      { kind: 'die', x: 1.9, y: 3.3, z: -2.4, s: 0.65, tint: 'ink' },
      { kind: 'coin', x: 1.6, y: -0.6, z: 0.1, s: 0.95, tint: 'yellow' },
      { kind: 'coin', x: 6.2, y: 2.4, z: -1.6, s: 0.8, tint: 'ink' },
      { kind: 'coin', x: 4.2, y: 3.4, z: -0.6, s: 0.55, tint: 'blue' },
    ]

    const makeMaterials = () => {
      for (const b of bodies) {
        const tint = (b.mesh.userData.tint as 'ink' | 'blue' | 'yellow') ?? 'ink'
        const body = tint === 'ink' ? inkBody : tint === 'blue' ? blue : yellow
        const pip = tint === 'ink' ? yellow : tint === 'blue' ? '#ffffff' : '#141619'
        const old = b.mesh.material
        if (b.kind === 'die') {
          b.mesh.material = dieMaterials(body, pip)
        } else {
          b.mesh.material = new THREE.MeshStandardMaterial({
            color: new THREE.Color(body),
            roughness: tint === 'ink' ? 0.5 : 0.35,
            metalness: tint === 'ink' ? 0.1 : 0.25,
          })
        }
        ;(Array.isArray(old) ? old : [old]).forEach((m) => {
          const mm = m as THREE.MeshStandardMaterial
          mm.map?.dispose()
          mm.dispose()
        })
      }
    }

    for (const s of spec) {
      const mesh = new THREE.Mesh(s.kind === 'die' ? dieGeo : coinGeo, new THREE.MeshStandardMaterial())
      mesh.userData.tint = s.tint
      mesh.scale.setScalar(s.s)
      mesh.rotation.set(rnd(0, Math.PI), rnd(0, Math.PI), rnd(0, Math.PI))
      const home = new THREE.Vector3(s.x, s.y, s.z)
      mesh.position.copy(home)
      group.add(mesh)
      bodies.push({
        mesh,
        kind: s.kind,
        home,
        pos: home.clone(),
        vel: new THREE.Vector3(),
        spin: new THREE.Vector3(rnd(-0.25, 0.25), rnd(-0.3, 0.3), rnd(-0.2, 0.2)),
        phase: rnd(0, Math.PI * 2),
        bob: rnd(0.12, 0.26),
        scale: s.s,
      })
    }
    makeMaterials()

    // Pointer in normalised device coords, and a world-space point on z=0.
    const pointer = new THREE.Vector2(-10, -10)
    const pointerTarget = new THREE.Vector2(-10, -10)
    const ray = new THREE.Raycaster()
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)
    const pointerWorld = new THREE.Vector3(999, 999, 0)
    let pointerActive = false

    const onMove = (e: PointerEvent) => {
      const r = host.getBoundingClientRect()
      pointerTarget.set(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1))
      pointerActive = true
    }
    const onLeave = () => {
      pointerActive = false
    }
    if (finePointer && !reduce) {
      window.addEventListener('pointermove', onMove, { passive: true })
      document.addEventListener('pointerleave', onLeave)
    }

    // Size
    const resize = () => {
      const w = host.clientWidth || 1
      const h = host.clientHeight || 1
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      // Keep the composition inside the frame on narrow screens.
      const narrow = w < 720
      group.position.x = narrow ? -2.3 : -1.1
      group.position.y = narrow ? 1.2 : 0
      group.scale.setScalar(narrow ? 0.62 : 0.98)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(host)

    // Visibility
    let visible = true
    const io = new IntersectionObserver(([en]) => {
      visible = en.isIntersecting
      if (visible && !reduce) schedule()
    })
    io.observe(host)
    const onVis = () => {
      if (!document.hidden && visible && !reduce) schedule()
    }
    document.addEventListener('visibilitychange', onVis)

    let raf = 0
    let last = performance.now()
    let t = 0
    const tmp = new THREE.Vector3()

    const step = (now: number) => {
      raf = 0
      const dt = Math.min(0.04, (now - last) / 1000)
      last = now
      t += dt

      // Pointer smoothing
      pointer.lerp(pointerTarget, 1 - Math.exp(-dt * 7))
      if (pointerActive) {
        ray.setFromCamera(pointer, camera)
        ray.ray.intersectPlane(plane, pointerWorld)
        // group is offset in x; bring the pointer into group space
        pointerWorld.x -= group.position.x
        pointerWorld.divideScalar(group.scale.x)
      } else {
        pointerWorld.set(999, 999, 0)
      }

      // Whole field leans toward the cursor
      const leanX = pointerActive ? pointer.y * 0.12 : 0
      const leanY = pointerActive ? pointer.x * 0.16 : 0
      group.rotation.x += (leanX - group.rotation.x) * (1 - Math.exp(-dt * 3))
      group.rotation.y += (leanY - group.rotation.y) * (1 - Math.exp(-dt * 3))

      for (const b of bodies) {
        // Spring to home, with a slow bob
        const targetY = b.home.y + Math.sin(t * 0.7 + b.phase) * b.bob
        const targetX = b.home.x + Math.cos(t * 0.5 + b.phase) * b.bob * 0.5
        tmp.set(targetX, targetY, b.home.z).sub(b.pos).multiplyScalar(4.5)
        b.vel.addScaledVector(tmp, dt)

        // Push away from the cursor (within a radius), stronger when close
        const dx = b.pos.x - pointerWorld.x
        const dy = b.pos.y - pointerWorld.y
        const d2 = dx * dx + dy * dy
        const R = 2.6
        if (d2 < R * R) {
          const d = Math.sqrt(d2) || 0.001
          const f = (1 - d / R) * 14
          b.vel.x += (dx / d) * f * dt
          b.vel.y += (dy / d) * f * dt
          // a nudge of spin when pushed
          b.mesh.rotation.z += f * dt * 0.08
        }

        // Damping
        b.vel.multiplyScalar(Math.exp(-dt * 3.2))
        b.pos.addScaledVector(b.vel, dt)
        b.mesh.position.copy(b.pos)

        b.mesh.rotation.x += b.spin.x * dt
        b.mesh.rotation.y += b.spin.y * dt
        b.mesh.rotation.z += b.spin.z * dt
      }

      renderer.render(scene, camera)
      if (visible && !document.hidden) schedule()
    }
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(step)
    }

    if (reduce) {
      renderer.render(scene, camera)
    } else {
      schedule()
    }

    const mo = new MutationObserver(() => {
      readPalette()
      makeMaterials()
      if (reduce) renderer.render(scene, camera)
    })
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      io.disconnect()
      mo.disconnect()
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerleave', onLeave)
      for (const b of bodies) {
        const m = b.mesh.material
        ;(Array.isArray(m) ? m : [m]).forEach((x) => {
          const mm = x as THREE.MeshStandardMaterial
          mm.map?.dispose()
          mm.dispose()
        })
      }
      dieGeo.dispose()
      coinGeo.dispose()
      renderer.dispose()
      host.removeChild(renderer.domElement)
    }
  }, [])

  return <div ref={ref} className={className} aria-hidden="true" />
}
