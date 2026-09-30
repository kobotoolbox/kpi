import React from 'react'

import { Navigate, Route } from 'react-router-dom'
import AuthContainer from '#/auth/AuthContainer/AuthContainer'
import { FeatureFlag } from '#/featureFlags'
import RequireAnonymous from '#/router/RequireAnonymous'
import RequireFeatureFlag from '#/router/RequireFeatureFlag'
import { AUTH_ROUTES, ROUTES } from '#/router/routerConstants'
import AuthAppProviders from './AuthAppProviders'
import AuthChangeRedirector from './AuthChangeRedirector'

const LoginRoute = React.lazy(() => import(/* webpackPrefetch: true */ './LoginRoute/LoginRoute'))
const RegisterRoute = React.lazy(() => import(/* webpackPrefetch: true */ './RegisterRoute/RegisterRoute'))
const ActivateAccountRoute = React.lazy(
  () => import(/* webpackPrefetch: true */ './ActivateAccountRoute/ActivateAccountRoute'),
)
const ResetPasswordRoute = React.lazy(
  () => import(/* webpackPrefetch: true */ './ResetPasswordRoute/ResetPasswordRoute'),
)
const NewPasswordRoute = React.lazy(() => import(/* webpackPrefetch: true */ './NewPasswordRoute/NewPasswordRoute'))
const ProviderLoginRoute = React.lazy(() => import(/* webpackPrefetch: true */ './ProviderRoute/ProviderLoginRoute'))
const ProviderSignupRoute = React.lazy(() => import(/* webpackPrefetch: true */ './ProviderRoute/ProviderSignupRoute'))

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
            <AuthChangeRedirector />
            <AuthContainer />
          </AuthAppProviders>
        </RequireFeatureFlag>
      }
    >
      {/* The two screens a session makes pointless */}
      <Route
        path={AUTH_ROUTES.LOGIN}
        element={
          <RequireAnonymous>
            <LoginRoute />
          </RequireAnonymous>
        }
      />
      <Route
        path={AUTH_ROUTES.SIGNUP}
        element={
          <RequireAnonymous>
            <RegisterRoute />
          </RequireAnonymous>
        }
      />

      <Route path={AUTH_ROUTES.CONFIRM_EMAIL} element={<ActivateAccountRoute />} />
      <Route path={AUTH_ROUTES.RESET_PASSWORD} element={<ResetPasswordRoute />} />
      <Route path={AUTH_ROUTES.NEW_PASSWORD} element={<NewPasswordRoute />} />

      {/*
        Addresses that are being handled by different routes and thus are not needed. Redirecting to login rather than
        showing SectionNotFound.
      */}
      <Route path={AUTH_ROUTES.MFA_AUTHENTICATE} element={<Navigate to={AUTH_ROUTES.LOGIN} replace />} />
      <Route path={AUTH_ROUTES.MFA_RECOVERY_CODES} element={<Navigate to={AUTH_ROUTES.LOGIN} replace />} />
      {/*
        Both halves of the single sign-on flow. `PROVIDER_SIGNUP` is also where allauth returns the browser
        after the provider round trip, whatever the outcome - see `ProviderSignupRoute`.
      */}
      <Route path={AUTH_ROUTES.PROVIDER_SIGNUP} element={<ProviderSignupRoute />} />
      <Route path={AUTH_ROUTES.PROVIDER_LOGIN} element={<ProviderLoginRoute />} />
    </Route>
  )
}
