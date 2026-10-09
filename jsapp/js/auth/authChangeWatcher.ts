import { queryClient } from '#/api/queryClient'
import type { AllauthResponse } from './allauthErrors'

// Keeps the cached session reading honest from every allauth answer, not just `GET /auth/session`.
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
