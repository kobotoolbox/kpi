import React from 'react'

import { Route } from 'react-router-dom'
import AuthContainer from '#/auth/AuthContainer/AuthContainer'
import { FeatureFlag } from '#/featureFlags'
import RequireFeatureFlag from '#/router/RequireFeatureFlag'
import { AUTH_ROUTES, ROUTES } from '#/router/routerConstants'
import AuthAppProviders from './AuthAppProviders'

const AuthTestRoute = React.lazy(() => import(/* webpackPrefetch: true */ './AuthTestRoute/AuthTestRoute'))

/**
 * Sign-in, registration and password recovery screens.
 *
 * Mounted next to `<App />` rather than inside it, so none of the logged in chrome applies - see
 * `#/router/router`. One feature flag check and one set of providers on the parent route covers every
 * screen underneath, so adding one is a single `<Route>`.
 */
export default function authRoutes() {
  return (
    <Route
      path={ROUTES.AUTH_ROOT}
      element={
        <RequireFeatureFlag flag={FeatureFlag.authRedesignEnabled}>
          <AuthAppProviders>
            <AuthContainer />
          </AuthAppProviders>
        </RequireFeatureFlag>
      }
    >
      <Route path={AUTH_ROUTES.TEST} element={<AuthTestRoute />} />
    </Route>
  )
}
