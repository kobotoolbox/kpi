import type { SocialApp } from '#/api/models/socialApp'
import { AUTH_ROUTES } from '#/router/routerConstants'

/**
 * The frontend half of allauth's single sign-on handshake.
 *
 * allauth drives the provider round trip itself; our side of it is two values - where to come back to, and
 * what to make of the `?error=` it may come back with.
 */

/**
 * The error codes allauth appends to the callback URL. From `allauth.socialaccount.providers.base.AuthError`,
 * which is everything it tells us about a handshake that did not finish.
 */
const PROVIDER_ERROR_CODES = {
  /** The provider's own screen was cancelled - usually the "no thanks" button on the consent page. */
  cancelled: 'cancelled',
  /** The provider refused the request, e.g. the account is not entitled to this application. */
  denied: 'denied',
  unknown: 'unknown',
} as const

/**
 * What to put in the redirect endpoint's `provider` field for one of `/environment`'s providers.
 *
 * `provider_id` is the per-app id an instance sets to tell several providers of the same kind apart;
 * `provider` is just the kind (`gitlab`, `openid_connect`, …). allauth resolves either, so prefer the unique
 * one. Same fallback the legacy `SsoSection` builds its links from.
 */
export function getProviderRedirectId(socialApp: SocialApp): string {
  return socialApp.provider_id || socialApp.provider
}

/**
 * Where allauth sends the browser once the provider is done with it. Absolute, because allauth redirects to
 * it rather than resolving it against anything.
 */
export function getProviderCallbackUrl(): string {
  return `${window.location.origin}/#${AUTH_ROUTES.PROVIDER_SIGNUP}`
}

/**
 * Reads allauth's `?error=` out of the two places a hash routed app has to look.
 *
 * allauth appends the parameter with a plain URL parse, which leaves the fragment alone:
 * `…/#/accounts/provider/signup` comes back as `…/?error=denied#/accounts/provider/signup`. The route's own
 * search is checked too, so this keeps working if that ever changes - and so stories can drive it.
 *
 * @param windowSearch `window.location.search` - where allauth actually writes
 * @param routeSearch the search string of the matched hash route
 */
export function readProviderRedirectError(windowSearch: string, routeSearch: string): string | null {
  return new URLSearchParams(windowSearch).get('error') ?? new URLSearchParams(routeSearch).get('error')
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
