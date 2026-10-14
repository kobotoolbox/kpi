import chai from 'chai'
import type { Flow } from '#/api/models/flow'
import { FlowId } from '#/api/models/flowId'
import { ACCOUNT_AUTH_ROUTES, AUTH_ROUTES } from '#/router/routerConstants'
import { ANONYMOUS_AUTH_STATUS, type AuthStatus } from './authStatus'
import { isReauthenticationRoutePath, pathForFlow, pathForPendingFlow, pathForReauthentication } from './flowRoutes'

/** Flows alone (which is all these functions read) */
const statusWithFlows = (flows: Flow[]): AuthStatus => {
  return {
    ...ANONYMOUS_AUTH_STATUS,
    flows,
    pendingFlow: flows.find((flow) => flow.is_pending) ?? null,
  }
}

describe('pathForFlow', () => {
  it('names the screen for a flow that has one', () => {
    chai.expect(pathForFlow({ id: FlowId.login })).to.equal(AUTH_ROUTES.LOGIN)
    chai.expect(pathForFlow({ id: FlowId.signup })).to.equal(AUTH_ROUTES.SIGNUP)
    chai.expect(pathForFlow({ id: FlowId.provider_signup })).to.equal(AUTH_ROUTES.PROVIDER_SIGNUP)
    chai.expect(pathForFlow({ id: FlowId.reauthenticate })).to.equal(ACCOUNT_AUTH_ROUTES.REAUTHENTICATE)
  })

  it('names the screen for the second factor allauth asked for', () => {
    chai
      .expect(pathForFlow({ id: FlowId.mfa_reauthenticate, types: ['totp'] }))
      .to.equal(ACCOUNT_AUTH_ROUTES.REAUTHENTICATE_TOTP)
    chai
      .expect(pathForFlow({ id: FlowId.mfa_reauthenticate, types: ['recovery_codes'] }))
      .to.equal(ACCOUNT_AUTH_ROUTES.REAUTHENTICATE_RECOVERY_CODES)
  })

  // Keying on `types[0]` alone, as allauth's example does, would answer `null` here.
  it('walks past a factor KPI has no screen for to one it does', () => {
    chai
      .expect(pathForFlow({ id: FlowId.mfa_reauthenticate, types: ['webauthn', 'totp'] }))
      .to.equal(ACCOUNT_AUTH_ROUTES.REAUTHENTICATE_TOTP)
  })

  it('answers nothing for a reauthentication KPI has no screen for at all', () => {
    chai.expect(pathForFlow({ id: FlowId.mfa_reauthenticate, types: ['webauthn'] })).to.equal(null)
  })

  it('answers nothing for the steps KPI keeps inside the card that started them', () => {
    chai.expect(pathForFlow({ id: FlowId.mfa_authenticate, types: ['totp'] })).to.equal(null)
    chai.expect(pathForFlow({ id: FlowId.verify_email })).to.equal(null)
  })

  it('answers nothing for a flow KPI does not turn on, rather than throwing', () => {
    chai.expect(pathForFlow({ id: FlowId.login_by_code })).to.equal(null)
    chai.expect(pathForFlow({ id: FlowId.verify_phone })).to.equal(null)
    chai.expect(pathForFlow({ id: FlowId.provider_redirect })).to.equal(null)
  })

  it('answers nothing for a flow it has never heard of', () => {
    chai.expect(pathForFlow({ id: 'login_by_carrier_pigeon' } as unknown as Flow)).to.equal(null)
  })
})

describe('pathForPendingFlow', () => {
  it('names the screen for whichever step allauth is waiting on', () => {
    const status = statusWithFlows([{ id: FlowId.login }, { id: FlowId.provider_signup, is_pending: true }])
    chai.expect(pathForPendingFlow(status)).to.equal(AUTH_ROUTES.PROVIDER_SIGNUP)
  })

  it('answers nothing when allauth is not waiting on anything', () => {
    chai.expect(pathForPendingFlow(statusWithFlows([{ id: FlowId.login }]))).to.equal(null)
  })
})

describe('pathForReauthentication', () => {
  it('prefers the flow allauth flagged', () => {
    const status = statusWithFlows([
      { id: FlowId.reauthenticate },
      { id: FlowId.mfa_reauthenticate, types: ['totp'], is_pending: true },
    ])
    chai.expect(pathForReauthentication(status)).to.equal(ACCOUNT_AUTH_ROUTES.REAUTHENTICATE_TOTP)
  })

  it('falls back to a reauthentication flow allauth merely offered', () => {
    const status = statusWithFlows([{ id: FlowId.login }, { id: FlowId.reauthenticate }])
    chai.expect(pathForReauthentication(status)).to.equal(ACCOUNT_AUTH_ROUTES.REAUTHENTICATE)
  })

  it('never falls back to a flow that is not a reauthentication', () => {
    const status = statusWithFlows([{ id: FlowId.login }, { id: FlowId.signup }])
    chai.expect(pathForReauthentication(status)).to.equal(null)
  })

  // A password prompt would just be refused in place of the security key allauth asked for.
  it('does not substitute another screen for a flagged factor it has no screen for', () => {
    const status = statusWithFlows([
      { id: FlowId.mfa_reauthenticate, types: ['webauthn'], is_pending: true },
      { id: FlowId.reauthenticate },
    ])
    chai.expect(pathForReauthentication(status)).to.equal(null)
  })

  it('answers nothing when allauth named no reauthentication at all', () => {
    chai.expect(pathForReauthentication(ANONYMOUS_AUTH_STATUS)).to.equal(null)
  })
})

describe('isReauthenticationRoutePath', () => {
  it('recognizes every screen the flow map points at', () => {
    chai.expect(isReauthenticationRoutePath(ACCOUNT_AUTH_ROUTES.REAUTHENTICATE)).to.equal(true)
    chai.expect(isReauthenticationRoutePath(ACCOUNT_AUTH_ROUTES.REAUTHENTICATE_TOTP)).to.equal(true)
    chai.expect(isReauthenticationRoutePath(ACCOUNT_AUTH_ROUTES.REAUTHENTICATE_RECOVERY_CODES)).to.equal(true)
  })

  it('recognizes nothing else', () => {
    chai.expect(isReauthenticationRoutePath(AUTH_ROUTES.LOGIN)).to.equal(false)
    chai.expect(isReauthenticationRoutePath(ACCOUNT_AUTH_ROUTES.MFA)).to.equal(false)
    chai.expect(isReauthenticationRoutePath('/projects/home')).to.equal(false)
  })
})
