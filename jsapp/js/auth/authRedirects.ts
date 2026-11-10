import { type NavigateFunction, matchPath } from 'react-router-dom'
import { AUTH_ROUTES } from '#/router/routerConstants'
import { AuthChangeEvent } from './authStatus'
import { getLoginRouteWithNext, getUrlForNextRoute, isAuthenticationScreen } from './nextUrl'

// Where each auth change sends somebody, kept apart from `AuthChangeRedirector` so the whole decision reads top to
// bottom and can be tested without a browser

/**
 * Screens where signing in is a side effect rather than the point (confirming an email address, or signing up on a
 * deployment that does not verify email). Each one ends by reporting what happened with a
 * `Continue to KoboToolbox` button pointing at `${ROOT_URL}/` - which is exactly where the `loggedIn` redirect below
 * would send somebody. Redirecting would press that button for them, before the message was read.
 *
 * Path patterns, not paths - one of them carries a `:key`, hence `matchPath` used below.
 */
const SELF_ANNOUNCED_SIGN_IN_ROUTES: readonly string[] = [AUTH_ROUTES.SIGNUP, AUTH_ROUTES.CONFIRM_EMAIL]

function announcesItsOwnSignIn(routePath: string): boolean {
  return SELF_ANNOUNCED_SIGN_IN_ROUTES.some((pattern) => matchPath(pattern, routePath) !== null)
}

/** What moved, as `AuthChangeRedirector` read it. */
export interface AuthChange {
  event: AuthChangeEvent
  /** Whether it came back from one of our own calls rather than the session poll - see `#/auth/authChangeWatcher` */
  isReadingFromOwnCall: boolean
}

/** Where the browser is, gathered up so the effect can read it in one go. */
export interface RedirectContext {
  navigate: NavigateFunction
  routePath: string
  /** The same route with its query string, which is what `next` uses */
  routeWithSearch: string
  nextRoute: string | null
  /** A page load, where `null` means this page again, but now with session it missed */
  goToPage: (url: string | null) => void
}

export function redirectForAuthChange(change: AuthChange, context: RedirectContext) {
  const { event, isReadingFromOwnCall } = change
  const { navigate, routePath, routeWithSearch, nextRoute, goToPage } = context

  switch (event) {
    case AuthChangeEvent.loggedOut: {
      const loginRoute = getLoginRouteWithNext(routeWithSearch)
      // Skips a navigation that would land where the browser already is
      if (loginRoute.split('?')[0] !== routePath) {
        // `replace`, since Back would return to a dead page
        navigate(loginRoute, { replace: true })
      }
      return
    }

    case AuthChangeEvent.loggedIn:
      // The screen is mid-sentence about the session it just created, so let it finish. A sign-in in another tab
      // leaves nothing worth reading here, and a signup form left open only earns a 409 on submit.
      if (isReadingFromOwnCall && announcesItsOwnSignIn(routePath)) {
        return
      }
      // The one move that cannot be a soft navigation - see `getUrlForNextRoute`. With nowhere named and not on an
      // authentication screen, this is a sign-in from another tab: already the right page, it just needs the session.
      if (nextRoute || isAuthenticationScreen(routePath)) {
        goToPage(getUrlForNextRoute(nextRoute))
      } else {
        goToPage(null)
      }
      return
  }
}
