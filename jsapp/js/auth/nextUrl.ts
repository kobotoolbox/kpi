import { AUTH_ROUTES, ROUTES } from '#/router/routerConstants'
import { isReauthenticationRoutePath } from './flowRoutes'

// Reading and writing `?next=` - the route to go to once authentication is out of the way.
//
// `next` can come from anywhere, so only hash routes of this app are accepted and everything else falls back to
// the site root. And reaching `/admin/` or the API docs is a matter of typing the address manually.

/** Just the bits of `window.location` we use */
type Origin = Pick<Location, 'origin' | 'pathname'>

/**
 * Django appends `next` with a plain URL parse, which leaves it outside the fragment, while KPI's own links put it
 * inside. Hence both `window.location.search` and the matched route's search.
 */
export function readNextParam(windowSearch: string, routeSearch: string): string | null {
  return new URLSearchParams(windowSearch).get('next') ?? new URLSearchParams(routeSearch).get('next')
}

/**
 * Returns the `next` route name (preserving its original query string and excluding any `#` hash), or `null` if it
 * doesn't match any of our routes.
 */
export function resolveNextRoute(rawNext: string | null, origin: Origin): string | null {
  if (!rawNext) {
    return null
  }

  let url: URL
  try {
    url = new URL(rawNext, origin.origin)
  } catch {
    return null
  }

  // Catches every scheme with no origin of its own too - `javascript:` and `data:` both report `"null"` here. Worth
  // checking even though only the fragment is read below, since `https://evil.example/#/projects/home` carries one.
  if (url.origin !== origin.origin) {
    return null
  }

  // `pathname` is compared against `/` as well, so this keeps working wherever `KPI_PREFIX` puts the app
  if (url.hash.startsWith('#/') && (url.pathname === origin.pathname || url.pathname === '/')) {
    return url.hash.slice(1)
  }

  // Same origin, but a Django page rather than a route of ours
  return null
}

/** Screens that exist only to send you onward, which is why `next` must never point at one */
function isAuthenticationScreen(routePath: string): boolean {
  return routePath.startsWith(ROUTES.ACCOUNTS_ROOT) || isReauthenticationRoutePath(routePath)
}

/** An authentication screen carrying `currentRoute` as `next`, so getting back there afterwards is automatic */
export function getRouteWithNext(routePath: string, currentRoute: string | null): string {
  if (!currentRoute) {
    return routePath
  }
  // The checks want the path alone, but the parameter keeps the query string: that is half of what made it the page.
  const [currentPath] = currentRoute.split('?')
  if (currentPath === routePath || isAuthenticationScreen(currentPath)) {
    return routePath
  }
  const params = new URLSearchParams({ next: `/#${currentRoute}` })
  return `${routePath}?${params}`
}

export function getLoginRouteWithNext(currentRoute: string | null): string {
  return getRouteWithNext(AUTH_ROUTES.LOGIN, currentRoute)
}

/**
 * A resolved `next` as something to hand `window.location.assign`, falling back to the site root.
 *
 * Signing in needs the page load even though the destination is always a route: `<App />` reads `/me/`, the permission
 * config and `/environment` at boot, and a route change refetches none of it.
 */
export function getUrlForNextRoute(routePath: string | null): string {
  return routePath === null ? '/' : `/#${routePath}`
}
