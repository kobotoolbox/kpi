import { useEffect, useRef } from 'react'
import { getAnonymousGateDecision } from '#/auth/authGate'
import type { AuthStatus } from '#/auth/authStatus'
import { getUrlForNextRoute } from '#/auth/nextUrl'
import { useAuthStatus } from '#/auth/useAuthStatus'
import { useNextRoute } from '#/auth/useNextRoute'
import LoadingSpinner from '#/components/common/loadingSpinner'

export interface RequireAnonymousProps {
  children: React.ReactNode
}

/**
 * The mirror of `RequireAuth` for the screens a session makes pointless.
 *
 * Decides on the reading it arrived with and then stays out of the way: a session appearing underneath one of these
 * screens is `AuthChangeRedirector`'s business, and swapping the card for a spinner would hide whatever the screen is
 * saying about the sign-in it just made.
 */
export default function RequireAnonymous({ children }: RequireAnonymousProps) {
  const { data: authStatus } = useAuthStatus()
  const nextRoute = useNextRoute()

  // `undefined` until allauth answers, which this gate does not wait for - see `getAnonymousGateDecision`
  const arrivalStatusRef = useRef<AuthStatus | undefined>(undefined)
  arrivalStatusRef.current ??= authStatus

  const decision = getAnonymousGateDecision({ authStatus: arrivalStatusRef.current })

  useEffect(() => {
    if (decision !== 'redirect') {
      return
    }
    window.location.assign(getUrlForNextRoute(nextRoute))
  }, [decision, nextRoute])

  // The spinner covers the gap between deciding to leave and the page load starting
  return decision === 'allow' ? <>{children}</> : <LoadingSpinner />
}
