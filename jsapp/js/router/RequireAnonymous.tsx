import { useEffect } from 'react'
import { getAnonymousGateDecision } from '#/auth/authGate'
import { getUrlForNextRoute } from '#/auth/nextUrl'
import { useAuthStatus } from '#/auth/useAuthStatus'
import { useNextRoute } from '#/auth/useNextRoute'
import LoadingSpinner from '#/components/common/loadingSpinner'

export interface RequireAnonymousProps {
  children: React.ReactNode
}

/** The mirror of `RequireAuth` for the screens a session makes pointless */
export default function RequireAnonymous({ children }: RequireAnonymousProps) {
  const { data: authStatus } = useAuthStatus()
  const nextRoute = useNextRoute()

  const decision = getAnonymousGateDecision({ authStatus })

  useEffect(() => {
    if (decision !== 'redirect') {
      return
    }
    window.location.assign(getUrlForNextRoute(nextRoute))
  }, [decision, nextRoute])

  // The spinner covers the gap between deciding to leave and the page load starting
  return decision === 'allow' ? <>{children}</> : <LoadingSpinner />
}
