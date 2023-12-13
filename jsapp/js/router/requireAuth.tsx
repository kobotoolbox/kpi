import React, {ReactElement, Suspense, useEffect, useState} from 'react';
import {RouteObject} from 'react-router-dom';
import sessionStore from 'js/stores/session';
import LoadingSpinner from '../components/common/loadingSpinner';
import {PATHS} from './routerConstants';

interface Props {
  children: RouteObject[] | undefined | ReactElement;
  redirect?: boolean;
}

export function getRedirectedLogin() {
  let loginUrl = PATHS.LOGIN;
  const loc = location.hash.split('#');
  const currentLoc = loc.length > 1 ? loc[1] : '';

  if (currentLoc) {
    const nextUrl = encodeURIComponent(`/#${currentLoc}`);
    loginUrl += `?next=${nextUrl}`;
  }

  window.location.href = loginUrl;
}

export default function RequireAuth({children, redirect = true}: Props) {
  const [session] = useState(() => sessionStore);

  useEffect(() => {
    if (redirect && !session.isLoggedIn) {
      getRedirectedLogin();
    }
  }, [session.isLoggedIn, redirect]);

  return redirect && session.isLoggedIn ? (
    <Suspense fallback={null}>{children}</Suspense>
  ) : (
    <LoadingSpinner />
  );
}
