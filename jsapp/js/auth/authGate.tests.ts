import chai from 'chai'
import { type GateInput, getAnonymousGateDecision, getAuthGateDecision } from './authGate'
import { ANONYMOUS_AUTH_STATUS, type AuthStatus } from './authStatus'

const signedIn: AuthStatus = {
  ...ANONYMOUS_AUTH_STATUS,
  isAuthenticated: true,
  user: { id: 7, display: 'sallyride', username: 'sallyride', has_usable_password: true, has_validated_password: true },
  methodCount: 1,
}

const reauthenticationRequired: AuthStatus = { ...signedIn, isReauthenticationRequired: true }

/** Nobody signed in, nothing in flight - each case below states only the part it is about. */
const gateInput = (overrides: Partial<GateInput> = {}): GateInput => ({
  authStatus: undefined,
  isAuthStatusLoading: false,
  isAuthStatusCheckFailed: false,
  isLegacyLoggedIn: false,
  ...overrides,
})

describe('getAuthGateDecision', () => {
  it('lets the session endpoint overrule `/me/`, which is the whole point of asking it', () => {
    const input = gateInput({ authStatus: ANONYMOUS_AUTH_STATUS, isLegacyLoggedIn: true })
    chai.expect(getAuthGateDecision(input)).to.equal('redirect')
  })

  it('allows a route on the endpoint`s word alone', () => {
    chai.expect(getAuthGateDecision(gateInput({ authStatus: signedIn }))).to.equal('allow')
  })

  // The session behind the ask is real, so whatever triggered it handles it.
  it('allows a route while allauth is asking for credentials again', () => {
    const input = gateInput({ authStatus: reauthenticationRequired, isLegacyLoggedIn: true })
    chai.expect(getAuthGateDecision(input)).to.equal('allow')
  })

  // The flag-off path, where the endpoint is never asked and `/me/` is the only answer there is.
  it('allows a route on the legacy answer alone', () => {
    chai.expect(getAuthGateDecision(gateInput({ isLegacyLoggedIn: true }))).to.equal('allow')
  })

  it('waits while the only source that might say yes has not answered', () => {
    chai.expect(getAuthGateDecision(gateInput({ isAuthStatusLoading: true }))).to.equal('wait')
  })

  it('says the check failed rather than turning a route down over an unreachable endpoint', () => {
    chai.expect(getAuthGateDecision(gateInput({ isAuthStatusCheckFailed: true }))).to.equal('checkFailed')
  })

  it('allows a route on the legacy answer even when the endpoint could not be reached', () => {
    const input = gateInput({ isAuthStatusCheckFailed: true, isLegacyLoggedIn: true })
    chai.expect(getAuthGateDecision(input)).to.equal('allow')
  })

  it('turns a route down when nothing says there is a session and nothing is going to', () => {
    chai.expect(getAuthGateDecision(gateInput())).to.equal('redirect')
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
