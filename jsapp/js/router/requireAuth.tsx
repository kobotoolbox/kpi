import React, { Suspense, useEffect, useState } from 'react'
import sessionStore from '#/stores/session'
import LoadingSpinner from '../components/common/loadingSpinner'
import { redirectToLogin } from './routerUtils'
import { RequireOrg } from './RequireOrg'

interface Props {
  children: React.ReactNode
}

export default function RequireAuth({ children }: Props) {
  const [session] = useState(() => sessionStore)

  useEffect(() => {
    if (!session.isLoggedIn) {
      redirectToLogin()
    }
  }, [session.isLoggedIn])

  return session.isLoggedIn ? (
    <Suspense fallback={null}>
      <RequireOrg>{children}</RequireOrg>
    </Suspense>
  ) : (
    <LoadingSpinner />
  )
}
