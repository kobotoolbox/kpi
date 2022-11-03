import React, {ReactElement, Suspense} from 'react';
import {stores} from 'js/stores';
import {RouteObject} from 'react-router-dom';
import AccessDenied from 'js/router/accessDenied';

interface Props {
  children: RouteObject[] | undefined | ReactElement;
}

/** https://gist.github.com/mjackson/d54b40a094277b7afdd6b81f51a0393f */
export default function RequireAuth({children}: Props) {
  const isAuthenticated = stores.session.isLoggedIn;
  return isAuthenticated ? (
    <Suspense fallback={null}>{children}</Suspense>
  ) : (
    <AccessDenied />
  );
}
