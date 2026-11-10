import type { User } from '#/api/models/user'
import type { AllauthResponse } from './allauthErrors'

// Reading an allauth session answer, and spotting what changed between two readings.
//
// Ported from `determineAuthChangeEvent` and the `authInfo` helper next to it in django-allauth react-spa example ( see
// https://codeberg.org/allauth/django-allauth/src/branch/main/examples/react-spa/frontend/src/auth/hooks.js).
//
// The status code carries the meaning: `200` a session with nothing outstanding, `401` either nobody signed in or
// somebody who has to prove it again (`meta.is_authenticated` tells those two apart).
//
// Note: only `loggedIn` and `loggedOut` are ported. KPI is to ask for reauthentication in place, on the account
// security screen (planned in DEV-1971), not on a route of its own, so the reference client's `reauthenticated` and
// `reauthenticationRequired` have nothing to redirect to. Its `flowUpdated` is left out because every sign-in step is
// answered inside the card that started it (the code in `LoginRoute`, the inbox panels after signup). Its `410` handling
// is left out too: allauth only sends that to `app` clients, and KPI is a `browser` one.

// Spelled out rather than taken from the generated response union
interface SessionResponseBody {
  data?: {
    user?: User
  }
  meta?: {
    is_authenticated?: boolean
  }
}

/** A session response, reduced to the info the app uses */
export interface AuthStatus {
  /** Also true for a 401 carrying `meta.is_authenticated`: allauth wants the password again, the session is real */
  isAuthenticated: boolean
  user: User | null
}

/** Nobody signed in. Also what a changed user id gets compared against - see {@link determineAuthChangeEvent}. */
export const ANONYMOUS_AUTH_STATUS: AuthStatus = Object.freeze({
  isAuthenticated: false,
  user: null,
})

/** Flattens a session response into the {@link AuthStatus}. */
export function getAuthStatus(response: AllauthResponse): AuthStatus {
  const body = response.data as SessionResponseBody | undefined
  const isAuthenticated = response.status === 200 || (response.status === 401 && body?.meta?.is_authenticated === true)

  return {
    isAuthenticated,
    user: isAuthenticated ? (body?.data?.user ?? null) : null,
  }
}

/** What changed between two readings of the session. */
export const AuthChangeEvent = {
  loggedOut: 'loggedOut',
  loggedIn: 'loggedIn',
} as const
export type AuthChangeEvent = (typeof AuthChangeEvent)[keyof typeof AuthChangeEvent]

/** Whether two readings name different accounts */
function hasUserChanged(fromStatus: AuthStatus, toStatus: AuthStatus): boolean {
  const fromId = fromStatus.user?.id
  const toId = toStatus.user?.id
  return fromId !== undefined && toId !== undefined && fromId !== toId
}

/** Which of the events the move between two readings is, or `null` when nothing worth reacting to changed */
export function determineAuthChangeEvent(fromStatus: AuthStatus, toStatus: AuthStatus): AuthChangeEvent | null {
  // Comparing two different accounts directly would report no change, so the old side is read as anonymous - which is
  // what a new account arriving amounts to
  const from = hasUserChanged(fromStatus, toStatus) ? ANONYMOUS_AUTH_STATUS : fromStatus

  if (!from.isAuthenticated && toStatus.isAuthenticated) {
    return AuthChangeEvent.loggedIn
  }

  if (from.isAuthenticated && !toStatus.isAuthenticated) {
    return AuthChangeEvent.loggedOut
  }

  return null
}
