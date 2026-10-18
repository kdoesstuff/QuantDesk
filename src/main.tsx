import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createHashRouter, RouterProvider } from 'react-router-dom'
import './styles/base.css'
import Shell from './app/Shell'
import Home from './pages/Home'
import Progress from './pages/Progress'
import SpeedArithmeticConfigPage from './drills/speedArithmetic/Config'
import SpeedArithmeticRun from './drills/speedArithmetic/Run'
import SpeedArithmeticResult from './drills/speedArithmetic/Result'

// Hash routing so the static build works anywhere without server rewrites.
// Switch to createBrowserRouter once hosted somewhere with SPA fallback.
const router = createHashRouter([
  {
    path: '/',
    element: <Shell />,
    children: [
      { index: true, element: <Home /> },
      { path: 'progress', element: <Progress /> },
      { path: 'drill/speed-arithmetic', element: <SpeedArithmeticConfigPage /> },
      { path: 'drill/speed-arithmetic/run', element: <SpeedArithmeticRun /> },
      { path: 'drill/speed-arithmetic/result/:id', element: <SpeedArithmeticResult /> },
    ],
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
