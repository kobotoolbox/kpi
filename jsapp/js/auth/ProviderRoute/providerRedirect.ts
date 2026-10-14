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
 * The codes from `allauth.socialaccount.providers.base.AuthError` that get their own wording. Its remaining
 * one, `unknown`, falls through to the generic message like anything unrecognised.
 */
const PROVIDER_ERROR_CODES = {
  /** The provider's own screen was cancelled - usually the "no thanks" button on the consent page. */
  cancelled: 'cancelled',
  /** The provider refused the request, e.g. the account is not entitled to this application. */
  denied: 'denied',
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
 * Where allauth sends the browser once the provider is done with it. Absolute, since allauth redirects to it
 * rather than resolving it, and built from {@link ROOT_URL} so an instance served under a prefix comes back
 * to its own app.
 *
 * Any `next` rides along inside the fragment: the round trip leaves the site, so a destination held anywhere
 * but the URL is gone by the time we are back. Carried verbatim - whatever reads it has to decide whether it
 * is safe.
 *
 * @param appRootUrl a parameter only so the prefixed case can be tested - `ROOT_URL` is fixed at import and
 * equals the origin on an unprefixed instance.
 */
export function getProviderCallbackUrl(windowSearch: string, routeSearch: string, appRootUrl = ROOT_URL): string {
  const next = readSearchParam('next', windowSearch, routeSearch)
  const search = next ? `?${new URLSearchParams({ next })}` : ''
  return `${appRootUrl}/#${AUTH_ROUTES.PROVIDER_SIGNUP}${search}`
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
