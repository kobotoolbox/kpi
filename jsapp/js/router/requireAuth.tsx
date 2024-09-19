import React, {Suspense, useEffect, useState} from 'react';
import sessionStore from 'js/stores/session';
import LoadingSpinner from '../components/common/loadingSpinner';
import {redirectToLogin} from './routerUtils';

interface Props {
  children: React.ReactNode;
  redirect?: boolean;
}

export default function RequireAuth({children, redirect = true}: Props) {
  const [session] = useState(() => sessionStore);

  useEffect(() => {
    if (redirect && !session.isLoggedIn) {
      redirectToLogin();
    }
  }, [session.isLoggedIn, redirect]);

  return redirect && session.isLoggedIn ? (
    <Suspense fallback={null}>{children}</Suspense>
  ) : (
    <LoadingSpinner />
  );
}
