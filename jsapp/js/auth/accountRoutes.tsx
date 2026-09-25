import React, { Suspense } from 'react'

import { Outlet, Route } from 'react-router-dom'
import { FeatureFlag } from '#/featureFlags'
import RequireFeatureFlag from '#/router/RequireFeatureFlag'
import { ACCOUNT_AUTH_ROUTES } from '#/router/routerConstants'

const AuthPlaceholderRoute = React.lazy(
  () => import(/* webpackPrefetch: true */ './AuthPlaceholderRoute/AuthPlaceholderRoute'),
)

/** The authentication screens that need a session */
export default function authAccountRoutes() {
  return (
    // Pathless layout route: adds nothing to the URL, only the flag check and lazy loading boundary.
    <Route
      element={
        <RequireFeatureFlag flag={FeatureFlag.authRedesignEnabled}>
          <Suspense fallback={null}>
            <Outlet />
          </Suspense>
        </RequireFeatureFlag>
      }
    >
      <Route path={ACCOUNT_AUTH_ROUTES.EMAIL} element={<AuthPlaceholderRoute title='Email addresses' />} />
      <Route path={ACCOUNT_AUTH_ROUTES.CHANGE_PASSWORD} element={<AuthPlaceholderRoute title='Change password' />} />
      <Route path={ACCOUNT_AUTH_ROUTES.PROVIDERS} element={<AuthPlaceholderRoute title='Connected accounts' />} />
      <Route path={ACCOUNT_AUTH_ROUTES.SESSIONS} element={<AuthPlaceholderRoute title='Active sessions' />} />

      {/* MFA related */}
      <Route path={ACCOUNT_AUTH_ROUTES.MFA} element={<AuthPlaceholderRoute title='Two-factor authentication' />} />
      <Route
        path={ACCOUNT_AUTH_ROUTES.MFA_TOTP_ACTIVATE}
        element={<AuthPlaceholderRoute title='Turn on two-factor authentication' />}
      />
      <Route
        path={ACCOUNT_AUTH_ROUTES.MFA_TOTP_DEACTIVATE}
        element={<AuthPlaceholderRoute title='Turn off two-factor authentication' />}
      />
      <Route path={ACCOUNT_AUTH_ROUTES.MFA_RECOVERY_CODES} element={<AuthPlaceholderRoute title='Recovery codes' />} />
      <Route
        path={ACCOUNT_AUTH_ROUTES.MFA_RECOVERY_CODES_GENERATE}
        element={<AuthPlaceholderRoute title='New recovery codes' />}
      />

      {/* Reauthentication */}
      <Route
        path={ACCOUNT_AUTH_ROUTES.REAUTHENTICATE}
        element={<AuthPlaceholderRoute title='Confirm your password' />}
      />
      <Route
        path={ACCOUNT_AUTH_ROUTES.REAUTHENTICATE_TOTP}
        element={<AuthPlaceholderRoute title='Confirm with a one-time code' />}
      />
      <Route
        path={ACCOUNT_AUTH_ROUTES.REAUTHENTICATE_RECOVERY_CODES}
        element={<AuthPlaceholderRoute title='Confirm with a recovery code' />}
      />
    </Route>
  )
}
