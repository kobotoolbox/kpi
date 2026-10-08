import { queryClient } from '#/api/queryClient'
import type { AllauthResponse } from './allauthErrors'

// Keeps the cached session reading honest: from every allauth answer, not just `GET /auth/session`, and from the
// 401s the rest of the API brings back once a session has ended.
//
// Inspired by https://codeberg.org/allauth/django-allauth/src/branch/main/examples/react-spa/frontend/src/lib/allauth.js.
//
// Uses the global `queryClient`, since `fetchAllauth` has no React tree to read one out of. Storybook gives each story
// its own client, so the feed is invisible there.

/**
 * The session query's key and URL, hand-written: `fetchAllauth` reaches this module, so importing the generated getters
 * would cycle. A test here fails if they ever drift from orval's.
 */
export const getAuthStatusQueryKey = () => ['api', 'v2', 'allauth', 'browser', 'v1', 'auth', 'session'] as const
export const AUTH_STATUS_URL = '/api/v2/allauth/browser/v1/auth/session'
/** The prefix every allauth endpoint shares */
export const ALLAUTH_BASE_URL = '/api/v2/allauth/'

/** The request an answer came back from, as `fetchAllauth` received it. */
export interface AllauthRequest {
  url: string
  method?: string
}

/** Only the part of a response body this module reads. */
interface AuthMetaBody {
  meta?: {
    is_authenticated?: boolean
  }
}

/**
 * Whether an allauth answer says anything about who is signed in. `401` and `410` always do, since allauth has no
 * other use for either status, and both carry a full reading. A `200` only when it claims `meta.is_authenticated` -
 * `getAuthStatus` reads any `200` as a live session, so `GET /config` and the `/account/*` lists have to stay out.
 */
export function isAuthChangeResponse(response: AllauthResponse): boolean {
  if (response.status === 401 || response.status === 410) {
    return true
  }

  const body = response.data as AuthMetaBody | undefined
  return response.status === 200 && body?.meta?.is_authenticated === true
}

/** The session query fetching for itself - the one answer react-query files without help. */
function isAuthStatusQueryFetch({ url, method = 'GET' }: AllauthRequest): boolean {
  return method === 'GET' && url.startsWith(AUTH_STATUS_URL)
}

/** Files an allauth answer as the newest session reading, if it is one. Anything else is left alone. */
export async function recordAllauthResponse(request: AllauthRequest, response: AllauthResponse): Promise<void> {
  if (!isAuthChangeResponse(response)) {
    return
  }

  const queryKey = getAuthStatusQueryKey()

  // react-query lets a landing query result beat a manual write, so an in-flight session fetch would undo this one -
  // and since `GET /auth/session` cannot express a reauthentication ask, that ask would be gone. Cancel-then-write is
  // what the optimistic update docs prescribe. Not for the session fetch's own answer: that would abort it mid-flight.
  if (!isAuthStatusQueryFetch(request)) {
    await queryClient.cancelQueries({ queryKey, exact: true })
  }

  queryClient.setQueryData(queryKey, response)
}

/** Any API answer, reduced to what tells us the session is no longer there. */
export interface AnyApiResponse {
  url: string
  status: number
  /** The parsed body, when the answer had one. Read for `meta.is_authenticated` alone. */
  body?: unknown
}

/**
 * Whether an answer proves the cached session reading wrong. Only a `401` does, and only away from allauth - two
 * exclusions that both exist because re-reading the session would lose something:
 *
 * - allauth answers `401` as ordinary data (an unfinished login, a reauthentication ask) and
 *   {@link recordAllauthResponse} has already filed what it says
 * - a `401` carrying `meta.is_authenticated` is a reauthentication ask
 */
export function isSessionEndedResponse({ url, status, body }: AnyApiResponse): boolean {
  if (status !== 401) {
    return false
  }

  // `includes` rather than `startsWith`, because `api.ts` and `dataInterface` prepend `ROOT_URL`
  if (url.includes(ALLAUTH_BASE_URL)) {
    return false
  }

  return (body as AuthMetaBody | undefined)?.meta?.is_authenticated !== true
}

/**
 * Marks the cached session reading out of date when an answer proves it is, so an expiry is noticed swiftly.
 *
 * Belongs in every transport that talks to the API: a `401` can come back through any of them.
 */
export function recordApiResponse(response: AnyApiResponse): void {
  if (!isSessionEndedResponse(response)) {
    return
  }

  void queryClient.invalidateQueries({ queryKey: getAuthStatusQueryKey(), exact: true })
}
