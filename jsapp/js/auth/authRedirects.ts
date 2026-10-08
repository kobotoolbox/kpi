import { type NavigateFunction, matchPath } from 'react-router-dom'
import { AUTH_ROUTES, ROUTES } from '#/router/routerConstants'
import { AuthChangeEvent, type AuthStatus } from './authStatus'
import { isReauthenticationRoutePath, pathForPendingFlow, pathForReauthentication } from './flowRoutes'
import { getLoginRouteWithNext, getRouteWithNext, getUrlForNextRoute } from './nextUrl'

// Where each auth change sends somebody, kept apart from `AuthChangeRedirector` so the whole decision reads top to
// bottom and can be tested without a browser

/**
 * Screens where signing in is a side effect rather than the point (confirming an email address, finishing a password
 * reset, or signing up on a deployment that does not verify email). Each one ends by reporting what happened with a
 * `Continue to KoboToolbox` button pointing at `${ROOT_URL}/` - which is exactly where the `loggedIn` redirect below
 * would send somebody. Redirecting would press that button for them, before the message was read.
 *
 * Path patterns, not paths - two of them carry a `:key`, hence `matchPath` used below.
 */
const SELF_ANNOUNCED_SIGN_IN_ROUTES: readonly string[] = [
  AUTH_ROUTES.SIGNUP,
  AUTH_ROUTES.CONFIRM_EMAIL,
  AUTH_ROUTES.NEW_PASSWORD,
]

function announcesItsOwnSignIn(routePath: string): boolean {
  return SELF_ANNOUNCED_SIGN_IN_ROUTES.some((pattern) => matchPath(pattern, routePath) !== null)
}

/** Where the browser is, gathered up so the effect can read it in one go. */
export interface RedirectContext {
  navigate: NavigateFunction
  routePath: string
  /** The same route with its query string, which is what `next` uses */
  routeWithSearch: string
  nextRoute: string | null
  goToPage: (url: string | null) => void
}

/** `status` is the new reading. */
export function redirectForAuthChange(event: AuthChangeEvent, status: AuthStatus, context: RedirectContext) {
  const { navigate, routePath, routeWithSearch, nextRoute, goToPage } = context

  /** Skips a navigation that would land where the browser already is */
  function goToRoute(pathWithSearch: string, { replace = false } = {}) {
    if (pathWithSearch.split('?')[0] === routePath) {
      return
    }
    navigate(pathWithSearch, { replace })
  }

  switch (event) {
    case AuthChangeEvent.loggedOut:
      // `replace`, since Back would return to a dead page
      goToRoute(getLoginRouteWithNext(routeWithSearch), { replace: true })
      return

    case AuthChangeEvent.loggedIn:
      // The screen is mid-sentence about the session that just appeared, so let it finish
      if (announcesItsOwnSignIn(routePath)) {
        return
      }
      // The one move that cannot be a soft navigation - see `getUrlForNextRoute`. With nowhere named and not on an
      // authentication screen, this is a sign-in from another tab: already the right page, it just needs the session.
      if (nextRoute || routePath.startsWith(ROUTES.AUTH_ROOT)) {
        goToPage(getUrlForNextRoute(nextRoute))
      } else {
        goToPage(null)
      }
      return

    case AuthChangeEvent.reauthenticationRequired: {
      const path = pathForReauthentication(status)
      // No path means allauth wants a credential KPI has no screen for, most likely a security key. Staying put lets
      // the screen that triggered this report the refusal itself.
      if (path) {
        goToRoute(getRouteWithNext(path, routeWithSearch))
      }
      return
    }

    case AuthChangeEvent.reauthenticated:
      // Only a reauthentication screen has somewhere to return to. Anywhere else this means a credential was added in
      // another tab, which is no reason to move somebody off the page they are on.
      if (isReauthenticationRoutePath(routePath)) {
        goToRoute(nextRoute ?? ROUTES.ACCOUNT_ROOT, { replace: true })
      }
      return

    case AuthChangeEvent.flowUpdated: {
      const path = pathForPendingFlow(status)
      // Most anonymous-side steps are answered inside the card that started them, so staying put is correct - see
      // `FLOW_PATHS`.
      if (path) {
        // `nextRoute`, not `routeWithSearch`: we are on an auth screen already, and `getRouteWithNext` refuses to
        // point `next` back at one. Passing the destination along keeps it across the step.
        goToRoute(getRouteWithNext(path, nextRoute), { replace: true })
      }
      return
    }
  }
}
