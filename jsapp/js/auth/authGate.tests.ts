import chai from 'chai'
import { getAnonymousGateDecision, getAuthGateDecision } from './authGate'
import { ANONYMOUS_AUTH_STATUS, type AuthStatus } from './authStatus'

const signedIn: AuthStatus = {
  ...ANONYMOUS_AUTH_STATUS,
  isAuthenticated: true,
  user: { id: 7, display: 'sallyride', username: 'sallyride', has_usable_password: true },
  methodCount: 1,
}

const reauthenticationRequired: AuthStatus = { ...signedIn, isReauthenticationRequired: true }

describe('getAuthGateDecision', () => {
  it('lets the session endpoint overrule `/me/`, which is the whole point of asking it', () => {
    chai
      .expect(
        getAuthGateDecision({
          authStatus: ANONYMOUS_AUTH_STATUS,
          isAuthStatusLoading: false,
          isLegacyLoggedIn: true,
        }),
      )
      .to.equal('redirect')
  })

  it('allows a route on the endpoint`s word alone', () => {
    chai
      .expect(getAuthGateDecision({ authStatus: signedIn, isAuthStatusLoading: false, isLegacyLoggedIn: false }))
      .to.equal('allow')
  })

  // The session behind the ask is real, so whatever triggered it handles it.
  it('allows a route while allauth is asking for credentials again', () => {
    chai
      .expect(
        getAuthGateDecision({
          authStatus: reauthenticationRequired,
          isAuthStatusLoading: false,
          isLegacyLoggedIn: true,
        }),
      )
      .to.equal('allow')
  })

  // The flag-off path, where the endpoint is never asked and `/me/` is the only answer there is.
  it('allows a route on the legacy answer alone', () => {
    chai
      .expect(getAuthGateDecision({ authStatus: undefined, isAuthStatusLoading: false, isLegacyLoggedIn: true }))
      .to.equal('allow')
  })

  it('waits while the only source that might say yes has not answered', () => {
    chai
      .expect(getAuthGateDecision({ authStatus: undefined, isAuthStatusLoading: true, isLegacyLoggedIn: false }))
      .to.equal('wait')
  })

  it('turns a route down when nothing says there is a session and nothing is going to', () => {
    chai
      .expect(getAuthGateDecision({ authStatus: undefined, isAuthStatusLoading: false, isLegacyLoggedIn: false }))
      .to.equal('redirect')
  })
})

describe('getAnonymousGateDecision', () => {
  it('shows the form to somebody with no session', () => {
    chai.expect(getAnonymousGateDecision({ authStatus: ANONYMOUS_AUTH_STATUS })).to.equal('allow')
  })

  it('sends somebody with a session on into the app', () => {
    chai.expect(getAnonymousGateDecision({ authStatus: signedIn })).to.equal('redirect')
  })

  it('shows the form before the endpoint has answered, even to a session it will turn away', () => {
    chai.expect(getAnonymousGateDecision({ authStatus: undefined })).to.equal('allow')
  })
})
