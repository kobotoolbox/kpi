import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { type RedirectContext, redirectForAuthChange } from './authRedirects'
import { type AuthStatus, determineAuthChangeEvent } from './authStatus'
import { useAuthStatus } from './useAuthStatus'
import { useNextRoute } from './useNextRoute'

/**
 * Redirects when the session changes underneath the page (acts only on a difference between two readings). Landing on
 * a route with an already dead session is `RequireAuth`'s job, and arriving at a sign-in screen with a live one is
 * `RequireAnonymous`'s. Where each change leads is `#/auth/authRedirects`.
 *
 * Readings come from every allauth answer, not just the session poll (see `#/auth/authChangeWatcher`), so this catches
 * the reauthentication an `/account/*` call asks for too.
 *
 * Renders nothing. Mount it inside a router and a `QueryClientProvider`.
 */
export default function AuthChangeRedirector() {
  const { data: authStatus } = useAuthStatus()
  const navigate = useNavigate()
  const { pathname, search } = useLocation()
  const nextRoute = useNextRoute()

  // `null` means "this page again, with the session it was loaded without".
  const goToPage = (url: string | null) => (url === null ? window.location.reload() : window.location.assign(url))

  // Kept out of the effect's dependencies: a redirect has to happen once per change in the session, not again every
  // time the address bar moves - which redirecting itself causes.
  const context: RedirectContext = {
    navigate,
    routePath: pathname,
    routeWithSearch: pathname + search,
    nextRoute,
    goToPage,
  }
  const contextRef = useRef<RedirectContext>(context)
  contextRef.current = context

  const previousStatusRef = useRef<AuthStatus | undefined>(undefined)

  useEffect(() => {
    if (!authStatus) {
      return
    }

    const previousStatus = previousStatusRef.current
    previousStatusRef.current = authStatus

    // Nothing has changed yet on the first reading. Treating it as a change would duplicate - or fight - what the
    // route's own guard already decided.
    if (!previousStatus) {
      return
    }

    const event = determineAuthChangeEvent(previousStatus, authStatus)
    if (event) {
      redirectForAuthChange(event, authStatus, contextRef.current)
    }
  }, [authStatus])

  return null
}
