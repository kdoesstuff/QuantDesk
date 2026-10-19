import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createHashRouter, RouterProvider, type RouteObject } from 'react-router-dom'
import './styles/base.css'
import Shell from './app/Shell'
import Home from './pages/Home'
import Progress from './pages/Progress'
import Method from './pages/Method'
import ErrorPage from './pages/ErrorPage'
import SpeedArithmeticConfigPage from './drills/speedArithmetic/Config'
import SpeedArithmeticRun from './drills/speedArithmetic/Run'
import SpeedArithmeticResult from './drills/speedArithmetic/Result'
import TypedConfig from './drills/typed/Config'
import TypedRun from './drills/typed/Run'
import TypedResult from './drills/typed/Result'
import type { TypedSpec } from './drills/typed/spec'
import { sequencesSpec } from './drills/typed/specs/sequences'
import { fractionsSpec } from './drills/typed/specs/fractions'
import { percentagesSpec } from './drills/typed/specs/percentages'
import { eightySpec } from './drills/typed/specs/eightyInEight'
import { kellySpec } from './drills/typed/specs/kelly'
import { etfArbSpec } from './drills/typed/specs/etfArb'
import { eventContractsSpec } from './drills/typed/specs/eventContracts'
import RoundsRun from './drills/rounds/Run'
import RoundsResult from './drills/rounds/Result'
import ConfigPage from './drills/shared/ConfigPage'
import type { RoundsSpec, Scenario } from './drills/rounds/spec'
import { diceMarketSpec, cardsMarketSpec } from './drills/rounds/specs/sumMarket'
import { bettingBoardSpec } from './drills/rounds/specs/bettingBoard'
import { makeMarketSpec } from './drills/rounds/specs/makeMarket'
import { fermiSpec } from './drills/rounds/specs/fermi'
import CognitiveRun from './drills/cognitive/Run'
import CognitiveResult from './drills/cognitive/Result'
import type { CognitiveSpec } from './drills/cognitive/spec'
import { memoryGridSpec } from './drills/cognitive/memoryGrid'
import { taskSwitchSpec } from './drills/cognitive/taskSwitch'
import { interceptSpec } from './drills/cognitive/intercept'
import { balloonSpec } from './drills/cognitive/balloon'
import { eventMakerSpec } from './drills/cognitive/eventMaker'
import { dutchBookSpec } from './drills/typed/specs/dutchBook'
import LiveRun from './drills/live/Run'
import LiveResult from './drills/live/Result'
import type { LiveConfig, LiveSpec } from './drills/live/spec'
import { raceSpec } from './drills/live/specs/race'
import { evidenceSpec } from './drills/live/specs/evidence'
import { tricksSpec } from './drills/typed/specs/tricks'
import { diceGamesSpec } from './drills/rounds/specs/diceGames'
import { stopOrRollSpec } from './drills/cognitive/stopOrRoll'

function typedRoutes<C extends object>(spec: TypedSpec<C>): RouteObject[] {
  return [
    { path: `drill/${spec.id}`, element: <TypedConfig key={spec.id} spec={spec} /> },
    { path: `drill/${spec.id}/run`, element: <TypedRun key={spec.id} spec={spec} /> },
    { path: `drill/${spec.id}/result/:id`, element: <TypedResult key={spec.id} spec={spec} /> },
  ]
}

function roundsRoutes<C extends object, S extends Scenario, D>(spec: RoundsSpec<C, S, D>): RouteObject[] {
  return [
    { path: `drill/${spec.id}`, element: <ConfigPage key={spec.id} spec={spec} /> },
    { path: `drill/${spec.id}/run`, element: <RoundsRun key={spec.id} spec={spec} /> },
    { path: `drill/${spec.id}/result/:id`, element: <RoundsResult key={spec.id} spec={spec} /> },
  ]
}

function cognitiveRoutes<C extends object>(spec: CognitiveSpec<C>): RouteObject[] {
  return [
    { path: `drill/${spec.id}`, element: <ConfigPage key={spec.id} spec={spec} /> },
    { path: `drill/${spec.id}/run`, element: <CognitiveRun key={spec.id} spec={spec} /> },
    { path: `drill/${spec.id}/result/:id`, element: <CognitiveResult key={spec.id} spec={spec} /> },
  ]
}

function liveRoutes<C extends LiveConfig, S>(spec: LiveSpec<C, S>): RouteObject[] {
  return [
    { path: `drill/${spec.id}`, element: <ConfigPage key={spec.id} spec={spec} /> },
    { path: `drill/${spec.id}/run`, element: <LiveRun key={spec.id} spec={spec} /> },
    { path: `drill/${spec.id}/result/:id`, element: <LiveResult key={spec.id} spec={spec} /> },
  ]
}

// Hash routing so the static build works anywhere without server rewrites.
// Switch to createBrowserRouter once hosted somewhere with SPA fallback.
// Each drill element carries a key: the same page component serves many
// drills, and without a key React would keep one drill's settings state when
// the sidebar jumps to another.
const router = createHashRouter([
  {
    path: '/',
    element: <Shell />,
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <Home /> },
      { path: 'progress', element: <Progress /> },
      { path: 'method', element: <Method /> },
      { path: 'drill/speed-arithmetic', element: <SpeedArithmeticConfigPage /> },
      { path: 'drill/speed-arithmetic/run', element: <SpeedArithmeticRun /> },
      { path: 'drill/speed-arithmetic/result/:id', element: <SpeedArithmeticResult /> },
      ...typedRoutes(eightySpec),
      ...typedRoutes(sequencesSpec),
      ...typedRoutes(fractionsSpec),
      ...typedRoutes(percentagesSpec),
      ...typedRoutes(tricksSpec),
      ...roundsRoutes(diceMarketSpec),
      ...roundsRoutes(cardsMarketSpec),
      ...roundsRoutes(diceGamesSpec),
      ...roundsRoutes(makeMarketSpec),
      ...roundsRoutes(bettingBoardSpec),
      ...typedRoutes(kellySpec),
      ...typedRoutes(etfArbSpec),
      ...typedRoutes(eventContractsSpec),
      ...roundsRoutes(fermiSpec),
      ...cognitiveRoutes(memoryGridSpec),
      ...cognitiveRoutes(taskSwitchSpec),
      ...cognitiveRoutes(interceptSpec),
      ...cognitiveRoutes(balloonSpec),
      ...typedRoutes(dutchBookSpec),
      ...liveRoutes(raceSpec),
      ...liveRoutes(evidenceSpec),
      ...cognitiveRoutes(eventMakerSpec),
      ...cognitiveRoutes(stopOrRollSpec),
      { path: '*', element: <ErrorPage notFound /> },
    ].map((r) => ({ ...r, errorElement: <ErrorPage /> })),
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
