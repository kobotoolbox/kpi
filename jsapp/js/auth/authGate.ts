import type { AuthStatus } from './authStatus'

// What `RequireAuth` and `RequireAnonymous` do with a route, kept apart from the components for testing purposes.

export type GateDecision = 'allow' | 'redirect' | 'wait'

export interface GateInput {
  /** `undefined` until allauth has answered */
  authStatus: AuthStatus | undefined
  /** From react-query's `isLoading`, not `isPending` (a disabled query stays pending and would spin forever) */
  isAuthStatusLoading: boolean
  /** DEV-1868 is going to remove this along with the flag */
  isLegacyLoggedIn: boolean
}

/** For the routes that need a session */
export function getAuthGateDecision({ authStatus, isAuthStatusLoading, isLegacyLoggedIn }: GateInput): GateDecision {
  if (authStatus) {
    return authStatus.isAuthenticated ? 'allow' : 'redirect'
  }
  if (isLegacyLoggedIn) {
    return 'allow'
  }
  // Waiting is only worth it while an answer is still coming
  return isAuthStatusLoading ? 'wait' : 'redirect'
}

/**
 * For the screens that only make sense without a session. Never waits - no need to delay showing login form for rare
 * cases when user arrives already signed in.
 */
export function getAnonymousGateDecision({ authStatus }: Pick<GateInput, 'authStatus'>): Exclude<GateDecision, 'wait'> {
  if (authStatus) {
    return authStatus.isAuthenticated ? 'redirect' : 'allow'
  }
  return 'allow'
}
