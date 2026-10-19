import { isRouteErrorResponse, Link, useLocation, useNavigate, useRouteError } from 'react-router-dom'
import { resetDrillConfig } from '../lib/config'
import { DRILL_IDS } from '../lib/storage'
import type { DrillId } from '../lib/types'

/**
 * What a visitor sees when a page throws. It names the page, offers the
 * two fixes that cover almost every case (try again, reset this game's
 * settings) and never shows a stack trace: that belongs in the console.
 */
export default function ErrorPage({ notFound: missing = false }: { notFound?: boolean }) {
  const err = useRouteError()
  const nav = useNavigate()
  const loc = useLocation()
  const drill = loc.pathname.match(/^\/drill\/([a-z0-9-]+)/)?.[1]
  const drillId = drill && (DRILL_IDS as readonly string[]).includes(drill) ? (drill as DrillId) : null

  const notFound = missing || (isRouteErrorResponse(err) && err.status === 404)
  const message = isRouteErrorResponse(err)
    ? `${err.status} ${err.statusText}`
    : err instanceof Error
      ? err.message
      : String(err ?? 'Unknown error')

  if (import.meta.env.DEV && err) console.error(err)

  return (
    <div className="page error-page">
      <p className="faint">{notFound ? 'Not found' : 'Something broke'}</p>
      <h1 className="display">{notFound ? 'No page here.' : 'This page hit an error.'}</h1>
      <p className="muted">
        {notFound
          ? 'The link may be old. Everything live is in the sidebar.'
          : 'Your runs are safe; they are stored on this device and nothing here touches them. Try the page again, or reset the settings for this game if it keeps happening.'}
      </p>
      {!notFound && (
        <p className="faint tnum error-page__detail" title={message}>
          {message}
        </p>
      )}
      <div className="error-page__actions">
        {!notFound && (
          <button className="btn btn-yellow" onClick={() => nav(0)}>
            Try again
          </button>
        )}
        {drillId && !notFound && (
          <button
            className="btn btn-primary"
            onClick={() => {
              resetDrillConfig(drillId)
              nav(`/drill/${drillId}`, { replace: true })
              nav(0)
            }}
          >
            Reset this game's settings
          </button>
        )}
        <Link to="/" className="btn">
          Home
        </Link>
      </div>
    </div>
  )
}
