import React from 'react'

import { Route } from 'react-router-dom'
import AuthContainer from '#/auth/AuthContainer/AuthContainer'
import { FeatureFlag } from '#/featureFlags'
import RequireFeatureFlag from '#/router/RequireFeatureFlag'
import { AUTH_ROUTES, ROUTES } from '#/router/routerConstants'
import AuthAppProviders from './AuthAppProviders'

const LoginRoute = React.lazy(() => import(/* webpackPrefetch: true */ './LoginRoute/LoginRoute'))
const RegisterRoute = React.lazy(() => import(/* webpackPrefetch: true */ './RegisterRoute/RegisterRoute'))
const ActivateAccountRoute = React.lazy(
  () => import(/* webpackPrefetch: true */ './ActivateAccountRoute/ActivateAccountRoute'),
)
const ResetPasswordRoute = React.lazy(
  () => import(/* webpackPrefetch: true */ './ResetPasswordRoute/ResetPasswordRoute'),
)
const NewPasswordRoute = React.lazy(() => import(/* webpackPrefetch: true */ './NewPasswordRoute/NewPasswordRoute'))
const AuthPlaceholderRoute = React.lazy(
  () => import(/* webpackPrefetch: true */ './AuthPlaceholderRoute/AuthPlaceholderRoute'),
)

/**
 * The authentication screens you reach without a session.
 *
 * Mounted next to `<App />` rather than inside it, so none of the logged in chrome applies - see
 * `#/router/router`. One feature flag check and one set of providers on the parent route covers every
 * screen underneath, so adding one is a single `<Route>`.
 */
export default function authRoutes() {
  return (
    <Route
      path={ROUTES.ACCOUNTS_ROOT}
      element={
        <RequireFeatureFlag flag={FeatureFlag.authRedesignEnabled}>
          <AuthAppProviders>
            <AuthContainer />
          </AuthAppProviders>
        </RequireFeatureFlag>
      }
    >
      <Route path={AUTH_ROUTES.LOGIN} element={<LoginRoute />} />
      <Route path={AUTH_ROUTES.SIGNUP} element={<RegisterRoute />} />
      <Route path={AUTH_ROUTES.VERIFY_EMAIL} element={<ActivateAccountRoute />} />
      <Route path={AUTH_ROUTES.RESET_PASSWORD} element={<ResetPasswordRoute />} />
      <Route path={AUTH_ROUTES.NEW_PASSWORD} element={<NewPasswordRoute />} />

      {/*
        `MfaForm` exists, but `LoginRoute` swaps it into its own card on success, so the URL stays on
        `/accounts/login`. Pointing this route at the real form would let you land on it with no sign-in
        underway, and what that shows is a redirect decision - see `PATHS.MFA_AUTHENTICATE`, DEV-1860.
      */}
      <Route path={AUTH_ROUTES.MFA_AUTHENTICATE} element={<AuthPlaceholderRoute title='One-time code' hasAuthCard />} />
      <Route
        path={AUTH_ROUTES.MFA_RECOVERY_CODES}
        element={<AuthPlaceholderRoute title='Recovery code' hasAuthCard />}
      />
      <Route
        path={AUTH_ROUTES.PROVIDER_SIGNUP}
        element={<AuthPlaceholderRoute title='Finish signing up' hasAuthCard />}
      />
    </Route>
  )
}
