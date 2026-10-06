import type React from 'react'
import { Suspense, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { getAuthGateDecision } from '#/auth/authGate'
import { getLoginRouteWithNext } from '#/auth/nextUrl'
import { useAuthStatus } from '#/auth/useAuthStatus'
import { FeatureFlag, useFeatureFlag } from '#/featureFlags'
import profileStore from '#/stores/profile'
import LoadingSpinner from '../components/common/loadingSpinner'
import { AuthCheckFailedCard } from './AuthCheckFailed'
import { RequireOrg } from './RequireOrg'
import { redirectToLogin } from './routerUtils'

interface Props {
  children: React.ReactNode
}

/** The routes that need a session. Without it sends user to the login screen keeping the destination in `?next=` */
export default function RequireAuth({ children }: Props) {
  const { data: authStatus, isLoading, isError } = useAuthStatus()
  const isAuthRedesignEnabled = useFeatureFlag(FeatureFlag.authRedesignEnabled)
  const navigate = useNavigate()
  const { pathname, search } = useLocation()

  const decision = getAuthGateDecision({
    authStatus,
    isAuthStatusLoading: isLoading,
    isAuthStatusCheckFailed: isError,
    // With the flag on, `/auth/session` answers for itself and the store is not consulted at all.
    isLegacyLoggedIn: isAuthRedesignEnabled ? false : profileStore.isLoggedIn,
  })

  useEffect(() => {
    if (decision !== 'redirect') {
      return
    }

    if (isAuthRedesignEnabled) {
      // We use `replace` as Back would return to a route that just turned somebody away
      navigate(getLoginRouteWithNext(pathname + search), { replace: true })
    } else {
      // TODO: DEV-1868 delete along with `FeatureFlag.authRedesignEnabled`. Without it there is no SPA login screen to
      // navigate to.
      redirectToLogin()
    }
  }, [decision, isAuthRedesignEnabled, navigate, pathname, search])

  // The same answer `allRoutes` gives for a failed `/me/`, with a way out that is not the login screen
  if (decision === 'checkFailed') {
    return <AuthCheckFailedCard />
  }

  if (decision !== 'allow') {
    return <LoadingSpinner />
  }

  return (
    <Suspense fallback={null}>
      <RequireOrg>{children}</RequireOrg>
    </Suspense>
  )
}
