import chai from 'chai'
import type { Flow } from '#/api/models/flow'
import { FlowId } from '#/api/models/flowId'
import { ROOT_URL } from '#/constants'
import { ACCOUNT_AUTH_ROUTES, AUTH_ROUTES, PROJECTS_ROUTES, ROUTES } from '#/router/routerConstants'
import { type RedirectContext, redirectForAuthChange } from './authRedirects'
import { ANONYMOUS_AUTH_STATUS, AuthChangeEvent, type AuthStatus } from './authStatus'

const signedIn: AuthStatus = {
  ...ANONYMOUS_AUTH_STATUS,
  isAuthenticated: true,
  user: { id: 7, display: 'sallyride', username: 'sallyride', has_usable_password: true, has_validated_password: true },
  methodCount: 1,
}

const statusWithFlows = (flows: Flow[], base: AuthStatus = signedIn): AuthStatus => {
  return {
    ...base,
    flows,
    pendingFlow: flows.find((flow) => flow.is_pending) ?? null,
  }
}

/**
 * Defaults put the browser on a project page with nowhere else named, which most events read as "stay put". Only the
 * plain fields are overridable, so the two spies keep their mock types.
 */
function contextAt(overrides: Partial<Omit<RedirectContext, 'navigate' | 'goToPage'>> = {}) {
  const routePath = overrides.routePath ?? PROJECTS_ROUTES.MY_PROJECTS
  return {
    navigate: jest.fn(),
    goToPage: jest.fn(),
    routePath,
    routeWithSearch: routePath,
    nextRoute: null,
    ...overrides,
  }
}

describe('redirectForAuthChange', () => {
  it('sends a session that ended to the login screen, carrying the page it interrupted', () => {
    const context = contextAt({ routePath: ACCOUNT_AUTH_ROUTES.MFA, routeWithSearch: `${ACCOUNT_AUTH_ROUTES.MFA}?a=1` })

    redirectForAuthChange(AuthChangeEvent.loggedOut, ANONYMOUS_AUTH_STATUS, context)

    chai
      .expect(context.navigate.mock.calls)
      .to.deep.equal([[`${AUTH_ROUTES.LOGIN}?next=%2F%23%2Faccount%2F2fa%3Fa%3D1`, { replace: true }]])
  })

  it('reloads rather than navigates on a sign-in, since the app boots its own state once', () => {
    const context = contextAt({ routePath: AUTH_ROUTES.LOGIN, nextRoute: PROJECTS_ROUTES.MY_PROJECTS })

    redirectForAuthChange(AuthChangeEvent.loggedIn, signedIn, context)

    chai.expect(context.goToPage.mock.calls).to.deep.equal([[`${ROOT_URL}/#${PROJECTS_ROUTES.MY_PROJECTS}`]])
    chai.expect(context.navigate.mock.calls).to.deep.equal([])
  })

  // A sign-in in another tab. Already the right page, it just needs the session, so `null` means "this page again".
  it('reloads in place when a sign-in lands somewhere other than an authentication screen', () => {
    const context = contextAt()

    redirectForAuthChange(AuthChangeEvent.loggedIn, signedIn, context)

    chai.expect(context.goToPage.mock.calls).to.deep.equal([[null]])
  })

  // The panel announcing it has a button out of it, and that acknowledgement is the point of the screen.
  it('leaves a sign-in alone on the screens that announce it themselves', () => {
    const paths = [
      // With `ACCOUNT_EMAIL_VERIFICATION` off, signup answers 200 and signs the new account straight in
      AUTH_ROUTES.SIGNUP,
      AUTH_ROUTES.CONFIRM_EMAIL.replace(':key', 'a-verification-key'),
      AUTH_ROUTES.NEW_PASSWORD.replace(':key', 'a-reset-key'),
    ]

    for (const routePath of paths) {
      const context = contextAt({ routePath })

      redirectForAuthChange(AuthChangeEvent.loggedIn, signedIn, context)

      chai.expect(context.goToPage.mock.calls, routePath).to.deep.equal([])
      chai.expect(context.navigate.mock.calls, routePath).to.deep.equal([])
    }
  })

  // Asking for the reset email never produces a session, so there is nothing for that screen to announce.
  it('still follows a sign-in off the screen that only asks for a reset email', () => {
    const context = contextAt({ routePath: AUTH_ROUTES.RESET_PASSWORD })

    redirectForAuthChange(AuthChangeEvent.loggedIn, signedIn, context)

    chai.expect(context.goToPage.mock.calls).to.deep.equal([[`${ROOT_URL}/`]])
  })

  it('sends a reauthentication ask to the screen allauth named, carrying the page to come back to', () => {
    const context = contextAt({ routePath: ACCOUNT_AUTH_ROUTES.MFA })
    const status = statusWithFlows([{ id: FlowId.reauthenticate }], { ...signedIn, isReauthenticationRequired: true })

    redirectForAuthChange(AuthChangeEvent.reauthenticationRequired, status, context)

    chai
      .expect(context.navigate.mock.calls)
      .to.deep.equal([[`${ACCOUNT_AUTH_ROUTES.REAUTHENTICATE}?next=%2F%23%2Faccount%2F2fa`, { replace: false }]])
  })

  // `webauthn` has no screen in KPI. Offering a different one would only have somebody refused.
  it('stays put when allauth asks for a credential KPI has no screen for', () => {
    const context = contextAt()
    const status = statusWithFlows([{ id: FlowId.mfa_reauthenticate, types: ['webauthn'] }], {
      ...signedIn,
      isReauthenticationRequired: true,
    })

    redirectForAuthChange(AuthChangeEvent.reauthenticationRequired, status, context)

    chai.expect(context.navigate.mock.calls).to.deep.equal([])
  })

  it('returns to `next` once credentials are accepted again', () => {
    const context = contextAt({ routePath: ACCOUNT_AUTH_ROUTES.REAUTHENTICATE, nextRoute: ACCOUNT_AUTH_ROUTES.MFA })

    redirectForAuthChange(AuthChangeEvent.reauthenticated, signedIn, context)

    chai.expect(context.navigate.mock.calls).to.deep.equal([[ACCOUNT_AUTH_ROUTES.MFA, { replace: true }]])
  })

  it('falls back to the account page when a reauthentication had nowhere to return to', () => {
    const context = contextAt({ routePath: ACCOUNT_AUTH_ROUTES.REAUTHENTICATE })

    redirectForAuthChange(AuthChangeEvent.reauthenticated, signedIn, context)

    chai.expect(context.navigate.mock.calls).to.deep.equal([[ROUTES.ACCOUNT_ROOT, { replace: true }]])
  })

  // A credential added in another tab is no reason to move somebody off the page they are on.
  it('ignores a reauthentication that lands anywhere but a reauthentication screen', () => {
    const context = contextAt()

    redirectForAuthChange(AuthChangeEvent.reauthenticated, signedIn, context)

    chai.expect(context.navigate.mock.calls).to.deep.equal([])
  })

  it('follows a half finished sign-in to the screen for the step it is waiting on', () => {
    const context = contextAt({ routePath: AUTH_ROUTES.LOGIN })
    const status = statusWithFlows([{ id: FlowId.provider_signup, is_pending: true }], ANONYMOUS_AUTH_STATUS)

    redirectForAuthChange(AuthChangeEvent.flowUpdated, status, context)

    chai.expect(context.navigate.mock.calls).to.deep.equal([[AUTH_ROUTES.PROVIDER_SIGNUP, { replace: true }]])
  })

  it('carries the destination to the step`s screen, so a flow started in another tab does not drop it', () => {
    const context = contextAt({ routePath: AUTH_ROUTES.LOGIN, nextRoute: PROJECTS_ROUTES.MY_PROJECTS })
    const status = statusWithFlows([{ id: FlowId.provider_signup, is_pending: true }], ANONYMOUS_AUTH_STATUS)

    redirectForAuthChange(AuthChangeEvent.flowUpdated, status, context)

    chai
      .expect(context.navigate.mock.calls)
      .to.deep.equal([[`${AUTH_ROUTES.PROVIDER_SIGNUP}?next=%2F%23%2Fprojects%2Fhome`, { replace: true }]])
  })

  // The card that started the step answers it in place - see `FLOW_PATHS`.
  it('stays put on a step with no screen of its own', () => {
    const context = contextAt({ routePath: AUTH_ROUTES.LOGIN })
    const status = statusWithFlows([{ id: FlowId.mfa_authenticate, is_pending: true }], ANONYMOUS_AUTH_STATUS)

    redirectForAuthChange(AuthChangeEvent.flowUpdated, status, context)

    chai.expect(context.navigate.mock.calls).to.deep.equal([])
  })

  it('does not navigate to the route it is already on, which is how a redirect loop starts', () => {
    const context = contextAt({ routePath: AUTH_ROUTES.LOGIN })

    redirectForAuthChange(AuthChangeEvent.loggedOut, ANONYMOUS_AUTH_STATUS, context)

    chai.expect(context.navigate.mock.calls).to.deep.equal([])
  })
})
