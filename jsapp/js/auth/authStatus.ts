import type { Flow } from '#/api/models/flow'
import type { User } from '#/api/models/user'
import type { AllauthResponse } from './allauthErrors'

// Reading allauth's `GET /auth/session`, and spotting what changed between two readings.
//
// Ported from `determineAuthChangeEvent` and the `authInfo` helper next to it in django-allauth react-spa example ( see
// https://codeberg.org/allauth/django-allauth/src/branch/main/examples/react-spa/frontend/src/auth/hooks.js).
//
// The status code carries the meaning, and all three answers are normal: `200` a session with nothing outstanding,
// `401` either nobody signed in or somebody who has to prove it again (`meta.is_authenticated` tells those two apart),
// `410` a session allauth has thrown away.

// Spelled out rather than taken from the generated response union
interface SessionResponseBody {
  data?: {
    flows?: Flow[]
    user?: User
    methods?: unknown[]
  }
  meta?: {
    is_authenticated?: boolean
  }
}

/** A session response, reduced to the info the app uses */
export interface AuthStatus {
  /** Also true for a 401 carrying `meta.is_authenticated`: allauth wants the password again, the session is real */
  isAuthenticated: boolean
  isReauthenticationRequired: boolean
  /** The session existed and allauth dropped it (which is not the same as never having had one) */
  isSessionGone: boolean
  /** Every step allauth named, flagged as pending or not */
  flows: Flow[]
  pendingFlow: Flow | null
  user: User | null
  /** Grows when a reauthentication lands, and after a page reload it is the only trace of that left */
  methodCount: number
}

/** Nobody signed in. Also what a changed user id gets compared against - see {@link determineAuthChangeEvent}. */
export const ANONYMOUS_AUTH_STATUS: AuthStatus = Object.freeze({
  isAuthenticated: false,
  isReauthenticationRequired: false,
  isSessionGone: false,
  flows: [],
  pendingFlow: null,
  user: null,
  methodCount: 0,
})

/** Flattens a session response into the {@link AuthStatus}. */
export function getAuthStatus(response: AllauthResponse): AuthStatus {
  const body = response.data as SessionResponseBody | undefined
  const flows = Array.isArray(body?.data?.flows) ? body.data.flows : []

  const isAuthenticated = response.status === 200 || (response.status === 401 && body?.meta?.is_authenticated === true)

  return {
    isAuthenticated,
    // Authenticated and still a 401 means the session is fine, the request was not enough
    isReauthenticationRequired: isAuthenticated && response.status === 401,
    isSessionGone: response.status === 410,
    flows,
    pendingFlow: flows.find((flow) => flow?.is_pending === true) ?? null,
    user: isAuthenticated ? (body?.data?.user ?? null) : null,
    methodCount: Array.isArray(body?.data?.methods) ? body.data.methods.length : 0,
  }
}

/** What changed between two readings of the session. */
export const AuthChangeEvent = {
  loggedOut: 'loggedOut',
  loggedIn: 'loggedIn',
  /** allauth got the credentials it asked for again, so whatever was interrupted may go ahead */
  reauthenticated: 'reauthenticated',
  /** allauth wants those credentials before it goes on */
  reauthenticationRequired: 'reauthenticationRequired',
  /** Nobody is signed in and the step allauth waits on has changed - a password accepted, a code wanted */
  flowUpdated: 'flowUpdated',
} as const
export type AuthChangeEvent = (typeof AuthChangeEvent)[keyof typeof AuthChangeEvent]

/** Whether two readings name different accounts */
function hasUserChanged(fromStatus: AuthStatus, toStatus: AuthStatus): boolean {
  const fromId = fromStatus.user?.id
  const toId = toStatus.user?.id
  return fromId !== undefined && toId !== undefined && fromId !== toId
}

/** Which of the five events the move between two readings is, or `null` when nothing worth reacting to changed */
export function determineAuthChangeEvent(fromStatus: AuthStatus, toStatus: AuthStatus): AuthChangeEvent | null {
  // A dropped session outranks everything else that could be read into the pair
  if (toStatus.isSessionGone) {
    return AuthChangeEvent.loggedOut
  }

  // Comparing two different accounts directly would report no change, so the old side is read as anonymous - which is
  // what a new account arriving amounts to
  const from = hasUserChanged(fromStatus, toStatus) ? ANONYMOUS_AUTH_STATUS : fromStatus

  if (!from.isAuthenticated && toStatus.isAuthenticated) {
    return AuthChangeEvent.loggedIn
  }

  if (from.isAuthenticated && !toStatus.isAuthenticated) {
    return AuthChangeEvent.loggedOut
  }

  if (from.isAuthenticated && toStatus.isAuthenticated) {
    if (toStatus.isReauthenticationRequired) {
      return AuthChangeEvent.reauthenticationRequired
    }
    if (from.isReauthenticationRequired) {
      return AuthChangeEvent.reauthenticated
    }
    // Reloading the reauthentication screen throws the flag above away. A method having been added is the other way to
    // tell that credentials were just accepted.
    if (from.methodCount < toStatus.methodCount) {
      return AuthChangeEvent.reauthenticated
    }
    return null
  }

  // Both sides anonymous: a sign-in is under way and has moved on to another step
  if (toStatus.pendingFlow && toStatus.pendingFlow.id !== from.pendingFlow?.id) {
    return AuthChangeEvent.flowUpdated
  }

  return null
}
