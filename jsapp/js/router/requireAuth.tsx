import type React from 'react'
import { Suspense, useEffect, useState } from 'react'
import profileStore from '#/stores/profile'
import LoadingSpinner from '../components/common/loadingSpinner'
import { RequireOrg } from './RequireOrg'
import { redirectToLogin } from './routerUtils'

interface Props {
  children: React.ReactNode
}

export default function RequireAuth({ children }: Props) {
  const [profile] = useState(() => profileStore)

  useEffect(() => {
    if (!profile.isLoggedIn) {
      redirectToLogin()
    }
  }, [profile.isLoggedIn])

  return profile.isLoggedIn ? (
    <Suspense fallback={null}>
      <RequireOrg>{children}</RequireOrg>
    </Suspense>
  ) : (
    <LoadingSpinner />
  )
}
