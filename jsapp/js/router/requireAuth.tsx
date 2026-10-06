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

  const decision = getAuthGateDecision({
    authStatus,
    isAuthStatusLoading: isLoading,
    isAuthStatusCheckFailed: isError,
    // With the flag on, `/auth/session` answers for itself and the store is not consulted at all.
    isLegacyLoggedIn: isAuthRedesignEnabled ? false : profileStore.isLoggedIn,
  })

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
