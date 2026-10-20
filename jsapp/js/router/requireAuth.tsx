import type React from 'react'
import { Suspense, useEffect } from 'react'
import { getAuthGateDecision } from '#/auth/authGate'
import { useAuthStatus } from '#/auth/useAuthStatus'
import { useGoToLogin } from '#/auth/useGoToLogin'
import { FeatureFlag, useFeatureFlag } from '#/featureFlags'
import profileStore from '#/stores/profile'
import LoadingSpinner from '../components/common/loadingSpinner'
import { AuthCheckFailedCard } from './AuthCheckFailed'
import { RequireOrg } from './RequireOrg'

interface Props {
  children: React.ReactNode
}

/** The routes that need a session. Without it sends user to the login screen keeping the destination in `?next=` */
export default function RequireAuth({ children }: Props) {
  const { data: authStatus, isLoading, isError } = useAuthStatus()
  const isAuthRedesignEnabled = useFeatureFlag(FeatureFlag.authRedesignEnabled)
  const goToLogin = useGoToLogin()

  // One whole reading per flag state, rather than field by field: with the flag off the session query never runs, so
  // nothing it holds is an answer - a disabled query still hands back whatever is in the cache - and the store is the
  // only reading there is.
  const decision = getAuthGateDecision(
    isAuthRedesignEnabled
      ? { authStatus, isAuthStatusLoading: isLoading, isAuthStatusCheckFailed: isError, isLegacyLoggedIn: false }
      : {
          authStatus: undefined,
          isAuthStatusLoading: false,
          isAuthStatusCheckFailed: false,
          isLegacyLoggedIn: profileStore.isLoggedIn,
        },
  )

  useEffect(() => {
    if (decision === 'redirect') {
      goToLogin()
    }
  }, [decision, goToLogin])

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
