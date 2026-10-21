import type { SocialApp } from '#/api/models/socialApp'
import { ROOT_URL } from '#/constants'
import { AUTH_ROUTES } from '#/router/routerConstants'

/**
 * The frontend half of allauth's single sign-on handshake.
 *
 * allauth drives the provider round trip itself; our side of it is two values - where to come back to, and
 * what to make of the `?error=` it may come back with.
 */

/**
 * The `?error=` codes worth their own wording. `cancelled` and `denied` come from the provider, the rest
 * from allauth's own checks once the handshake is back.
 *
 * The copy lives on this side because only the code survives the redirect - allauth's own message goes to
 * the Django messages framework, which the SPA never sees.
 */
export const PROVIDER_ERROR_CODES = {
  /** The provider's own screen was cancelled - usually the "no thanks" button on the consent page. */
  cancelled: 'cancelled',
  /** The provider refused the request, e.g. the account is not entitled to this application. */
  denied: 'denied',
  /** The provider account is attached to somebody else's KoboToolbox account already. */
  connectedOther: 'connected_other',
  /** The session is too old for a change this sensitive. */
  reauthenticationRequired: 'reauthentication_required',
  /** allauth itself refused the connection, rather than the provider having done so. */
  permissionDenied: 'permission_denied',
} as const

/**
 * What to put in the redirect endpoint's `provider` field. `provider_id` tells several providers of the same
 * kind apart, `provider` is just the kind - allauth resolves either, so prefer the unique one. Same fallback
 * the legacy `SsoSection` uses.
 */
export function getProviderRedirectId(socialApp: SocialApp): string {
  return socialApp.provider_id || socialApp.provider
}

/**
 * A parameter from either place a hash routed app has to look: the real query string first, then the matched
 * route's own. allauth appends to the real one, since it parses the callback URL and leaves the fragment
 * alone - `…/#/auth/provider/signup` comes back as `…/?error=denied#/auth/provider/signup`.
 *
 * @param windowSearch `window.location.search`
 * @param routeSearch the search string of the matched hash route, where KPI's own links write theirs
 */
function readSearchParam(name: string, windowSearch: string, routeSearch: string): string | null {
  return new URLSearchParams(windowSearch).get(name) ?? new URLSearchParams(routeSearch).get(name)
}

/**
 * An absolute URL for one of our hash routes, which is what a `callback_url` has to be - allauth redirects
 * to it rather than resolving it
 *
 * @param appRootUrl is a parameter so the prefixed case can be tested
 */
export function getAbsoluteHashUrl(route: string, search = '', appRootUrl = ROOT_URL): string {
  return `${appRootUrl}/#${route}${search}`
}

/**
 * Where allauth sends the browser once the provider is done with a `login`.
 *
 * Any `next` rides along in the fragment, since the round trip leaves the site and nothing but the URL survives it.
 */
export function getProviderCallbackUrl(windowSearch: string, routeSearch: string, appRootUrl = ROOT_URL): string {
  const next = readSearchParam('next', windowSearch, routeSearch)
  const search = next ? `?${new URLSearchParams({ next })}` : ''
  return getAbsoluteHashUrl(AUTH_ROUTES.PROVIDER_SIGNUP, search, appRootUrl)
}

/** allauth's `?error=` code for a handshake that did not finish, or `null` for one that did. */
export function readProviderRedirectError(windowSearch: string, routeSearch: string): string | null {
  return readSearchParam('error', windowSearch, routeSearch)
}

/** What to show for an `?error=` code. Unknown codes get the generic wording rather than being shown raw. */
export function getProviderRedirectErrorMessage(code: string): string {
  if (code === PROVIDER_ERROR_CODES.cancelled) {
    return t('The login was cancelled before it finished. You can try again.')
  }
  if (code === PROVIDER_ERROR_CODES.denied) {
    return t('Your login provider refused the request. Please contact your administrator if this continues.')
  }
  return t('We could not complete the login with your provider. Please try again.')
}
