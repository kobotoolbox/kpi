import { ROOT_URL } from '#/constants'

/**
 * Adds the root URL to relative URLs, so calls still work when KPI runs under a prefix (`KPI_PREFIX`).
 * Absolute URLs are left alone.
 *
 * @param rootUrl overridable for tests
 */
export function prependRootUrl(url: string, rootUrl = ROOT_URL): string {
  return url.startsWith('/') ? `${rootUrl}${url}` : url
}
