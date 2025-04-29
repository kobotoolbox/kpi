import type React from 'react';
import {Suspense, useEffect, useState} from 'react';
import sessionStore from 'js/stores/session';
import LoadingSpinner from '../components/common/loadingSpinner';
import {redirectToLogin} from './routerUtils';
import { RequireOrg } from './RequireOrg';

interface Props {
  children: React.ReactNode;
  redirect?: boolean;
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
