import chai from 'chai'
import { ACCOUNT_ROUTES } from '#/account/routes.constants'
import { ROOT_URL } from '#/constants'
import { AUTH_ROUTES, PROJECTS_ROUTES } from '#/router/routerConstants'
import { type AuthChange, type RedirectContext, redirectForAuthChange } from './authRedirects'
import { AuthChangeEvent } from './authStatus'

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

/** A change this tab brought on itself, which is every one of these but the sign-in made somewhere else. */
const change = (event: AuthChangeEvent): AuthChange => ({
  event,
  isReadingFromOwnCall: true,
})

/** Arriving on the session poll instead - the only way another tab's sign-in reaches us. */
const changeFromAnotherTab = (event: AuthChangeEvent): AuthChange => ({
  ...change(event),
  isReadingFromOwnCall: false,
})

describe('redirectForAuthChange', () => {
  it('sends a session that ended to the login screen, carrying the page it interrupted', () => {
    const context = contextAt({ routePath: ACCOUNT_ROUTES.SECURITY, routeWithSearch: `${ACCOUNT_ROUTES.SECURITY}?a=1` })

    redirectForAuthChange(change(AuthChangeEvent.loggedOut), context)

    chai
      .expect(context.navigate.mock.calls)
      .to.deep.equal([[`${AUTH_ROUTES.LOGIN}?next=%2F%23%2Faccount%2Fsecurity%3Fa%3D1`, { replace: true }]])
  })

  it('reloads rather than navigates on a sign-in, since the app boots its own state once', () => {
    const context = contextAt({ routePath: AUTH_ROUTES.LOGIN, nextRoute: PROJECTS_ROUTES.MY_PROJECTS })

    redirectForAuthChange(change(AuthChangeEvent.loggedIn), context)

    chai.expect(context.goToPage.mock.calls).to.deep.equal([[`${ROOT_URL}/#${PROJECTS_ROUTES.MY_PROJECTS}`]])
    chai.expect(context.navigate.mock.calls).to.deep.equal([])
  })

  // A sign-in in another tab. Already the right page, it just needs the session, so `null` means "this page again".
  it('reloads in place when a sign-in lands somewhere other than an authentication screen', () => {
    const context = contextAt()

    redirectForAuthChange(change(AuthChangeEvent.loggedIn), context)

    chai.expect(context.goToPage.mock.calls).to.deep.equal([[null]])
  })

  // The panel announcing it has a button out of it, and that acknowledgement is the point of the screen.
  it('leaves a sign-in alone on the screens that announce it themselves', () => {
    const paths = [
      // With `ACCOUNT_EMAIL_VERIFICATION` off, signup answers 200 and signs the new account straight in
      AUTH_ROUTES.SIGNUP,
      AUTH_ROUTES.CONFIRM_EMAIL.replace(':key', 'a-verification-key'),
    ]

    for (const routePath of paths) {
      const context = contextAt({ routePath })

      redirectForAuthChange(change(AuthChangeEvent.loggedIn), context)

      chai.expect(context.goToPage.mock.calls, routePath).to.deep.equal([])
      chai.expect(context.navigate.mock.calls, routePath).to.deep.equal([])
    }
  })

  // Nothing on screen is about this sign-in, and allauth answers 409 to a signup from somebody already signed in.
  it('follows a sign-in these screens had no hand in off them anyway', () => {
    const context = contextAt({ routePath: AUTH_ROUTES.SIGNUP })

    redirectForAuthChange(changeFromAnotherTab(AuthChangeEvent.loggedIn), context)

    chai.expect(context.goToPage.mock.calls).to.deep.equal([[`${ROOT_URL}/`]])
  })

  // Asking for the reset email never produces a session, so there is nothing for that screen to announce.
  it('still follows a sign-in off the screen that only asks for a reset email', () => {
    const context = contextAt({ routePath: AUTH_ROUTES.RESET_PASSWORD })

    redirectForAuthChange(change(AuthChangeEvent.loggedIn), context)

    chai.expect(context.goToPage.mock.calls).to.deep.equal([[`${ROOT_URL}/`]])
  })

  // Otherwise login would navigate to itself, and a password reset would hide its success panel.
  it('leaves a session that ended alone on the authentication screens', () => {
    const paths = [AUTH_ROUTES.LOGIN, AUTH_ROUTES.NEW_PASSWORD.replace(':key', 'a-reset-key')]

    for (const routePath of paths) {
      const context = contextAt({ routePath })

      redirectForAuthChange(change(AuthChangeEvent.loggedOut), context)

      chai.expect(context.navigate.mock.calls, routePath).to.deep.equal([])
      chai.expect(context.goToPage.mock.calls, routePath).to.deep.equal([])
    }
  })
})
