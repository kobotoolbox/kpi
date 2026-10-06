import { queryClient } from '#/api/queryClient'
import type { AllauthResponse } from './allauthErrors'

// Keeps the cached session reading honest from every allauth answer, not just `GET /auth/session`.
//
// Inspired by https://codeberg.org/allauth/django-allauth/src/branch/main/examples/react-spa/frontend/src/lib/allauth.js.
//
// Uses the global `queryClient`, since `fetchAllauth` has no React tree to read one out of. Storybook gives each story
// its own client, so the feed is invisible there.

/**
 * The session query's key, hand-written: `fetchAllauth` reaches this module, so importing the generated getter would
 * cycle. `authChangeWatcher.tests.ts` ensures suite fails if things ever diverge.
 */
export const getAuthStatusQueryKey = () => ['api', 'v2', 'allauth', 'browser', 'v1', 'auth', 'session'] as const

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

/** Files an allauth answer as the newest session reading, if it is one. Anything else is left alone. */
export function recordAllauthResponse(response: AllauthResponse): void {
  if (!isAuthChangeResponse(response)) {
    return
  }

  queryClient.setQueryData(getAuthStatusQueryKey(), response)
}
