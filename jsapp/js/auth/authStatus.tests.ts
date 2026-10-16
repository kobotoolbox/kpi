import chai from 'chai'
import { FlowId } from '#/api/models/flowId'
import type { AllauthResponse } from './allauthErrors'
import {
  ANONYMOUS_AUTH_STATUS,
  AuthChangeEvent,
  type AuthStatus,
  determineAuthChangeEvent,
  getAuthStatus,
} from './authStatus'

const user = { id: 7, display: 'sallyride', username: 'sallyride', has_usable_password: true }
const otherUser = { ...user, id: 8, display: 'marswatney', username: 'marswatney' }

/** As `fetchAllauth` hands it over: allauth's own body nested under `data`. */
const response = (status: number, body: unknown = {}): AllauthResponse => ({ status, data: body })

const authenticated = (methods: unknown[] = [{ method: 'password' }]) =>
  getAuthStatus(response(200, { data: { user, methods }, meta: { is_authenticated: true } }))

const anonymous = (flows: unknown[] = [{ id: FlowId.login }]) =>
  getAuthStatus(response(401, { data: { flows }, meta: { is_authenticated: false } }))

const reauthenticationRequired = (methods: unknown[] = [{ method: 'password' }]) =>
  getAuthStatus(
    response(401, {
      data: { user, methods, flows: [{ id: FlowId.reauthenticate, is_pending: true }] },
      meta: { is_authenticated: true },
    }),
  )

describe('getAuthStatus', () => {
  it('reads a 200 as a session', () => {
    const status = authenticated()
    chai.expect(status.isAuthenticated).to.equal(true)
    chai.expect(status.isReauthenticationRequired).to.equal(false)
    chai.expect(status.isSessionGone).to.equal(false)
    chai.expect(status.user).to.deep.equal(user)
  })

  it('reads a plain 401 as nobody signed in', () => {
    const status = anonymous()
    chai.expect(status.isAuthenticated).to.equal(false)
    chai.expect(status.user).to.equal(null)
  })

  it('reads a 401 that claims a session as a reauthentication being asked for', () => {
    const status = reauthenticationRequired()
    chai.expect(status.isAuthenticated).to.equal(true)
    chai.expect(status.isReauthenticationRequired).to.equal(true)
    chai.expect(status.user).to.deep.equal(user)
  })

  it('reads a 410 as the session having been thrown away', () => {
    const status = getAuthStatus(response(410, { data: {}, meta: { is_authenticated: false } }))
    chai.expect(status.isSessionGone).to.equal(true)
    chai.expect(status.isAuthenticated).to.equal(false)
  })

  it('never reports a user without a session, whatever the body says', () => {
    const status = getAuthStatus(response(401, { data: { user }, meta: { is_authenticated: false } }))
    chai.expect(status.user).to.equal(null)
  })

  it('picks out the pending flow, and nothing else', () => {
    const status = anonymous([{ id: FlowId.login }, { id: FlowId.mfa_authenticate, is_pending: true }])
    chai.expect(status.pendingFlow?.id).to.equal(FlowId.mfa_authenticate)
    chai.expect(status.flows).to.have.lengthOf(2)
  })

  it('has no pending flow when allauth flagged none', () => {
    chai.expect(anonymous().pendingFlow).to.equal(null)
  })

  it('counts the methods that went into the session', () => {
    chai.expect(authenticated([{ method: 'password' }, { method: 'mfa' }]).methodCount).to.equal(2)
  })

  it('survives a body with nothing in it', () => {
    const status = getAuthStatus(response(401))
    chai.expect(status.flows).to.deep.equal([])
    chai.expect(status.pendingFlow).to.equal(null)
    chai.expect(status.methodCount).to.equal(0)
  })

  it('survives `flows` and `methods` arriving as something other than arrays', () => {
    const status = getAuthStatus(response(401, { data: { flows: 'login', methods: 3 } }))
    chai.expect(status.flows).to.deep.equal([])
    chai.expect(status.methodCount).to.equal(0)
  })
})

describe('determineAuthChangeEvent', () => {
  it('reports nothing when the reading has not changed', () => {
    chai.expect(determineAuthChangeEvent(authenticated(), authenticated())).to.equal(null)
    chai.expect(determineAuthChangeEvent(anonymous(), anonymous())).to.equal(null)
  })

  it('reports a sign-in', () => {
    chai.expect(determineAuthChangeEvent(anonymous(), authenticated())).to.equal(AuthChangeEvent.loggedIn)
    chai.expect(determineAuthChangeEvent(ANONYMOUS_AUTH_STATUS, authenticated())).to.equal(AuthChangeEvent.loggedIn)
  })

  it('reports a sign-out', () => {
    chai.expect(determineAuthChangeEvent(authenticated(), anonymous())).to.equal(AuthChangeEvent.loggedOut)
  })

  it('reports a dropped session ahead of anything else the pair could mean', () => {
    const sessionGone = getAuthStatus(response(410, {}))
    chai.expect(determineAuthChangeEvent(authenticated(), sessionGone)).to.equal(AuthChangeEvent.loggedOut)
    chai.expect(determineAuthChangeEvent(anonymous(), sessionGone)).to.equal(AuthChangeEvent.loggedOut)
  })

  it('reports a different account as a fresh sign-in, not as no change at all', () => {
    const asOther = getAuthStatus(
      response(200, { data: { user: otherUser, methods: [{ method: 'password' }] }, meta: { is_authenticated: true } }),
    )
    chai.expect(determineAuthChangeEvent(authenticated(), asOther)).to.equal(AuthChangeEvent.loggedIn)
  })

  it('reports allauth asking for credentials again', () => {
    chai
      .expect(determineAuthChangeEvent(authenticated(), reauthenticationRequired()))
      .to.equal(AuthChangeEvent.reauthenticationRequired)
  })

  it('reports those credentials being accepted', () => {
    chai
      .expect(determineAuthChangeEvent(reauthenticationRequired(), authenticated()))
      .to.equal(AuthChangeEvent.reauthenticated)
  })

  it('reports a reauthentication from a method having been added, with no flag to go on', () => {
    const before = authenticated([{ method: 'password' }])
    const after = authenticated([{ method: 'password' }, { method: 'password', reauthenticated: true }])
    chai.expect(determineAuthChangeEvent(before, after)).to.equal(AuthChangeEvent.reauthenticated)
  })

  it('does not report a reauthentication when a method was dropped instead', () => {
    const before = authenticated([{ method: 'password' }, { method: 'mfa' }])
    chai.expect(determineAuthChangeEvent(before, authenticated([{ method: 'password' }]))).to.equal(null)
  })

  it('reports a half finished sign-in moving on to another step', () => {
    const afterPassword = anonymous([{ id: FlowId.login }, { id: FlowId.mfa_authenticate, is_pending: true }])
    chai.expect(determineAuthChangeEvent(anonymous(), afterPassword)).to.equal(AuthChangeEvent.flowUpdated)
  })

  it('does not report the same pending step twice', () => {
    const pending = anonymous([{ id: FlowId.verify_email, is_pending: true }])
    chai.expect(determineAuthChangeEvent(pending, pending)).to.equal(null)
  })

  // allauth lists the flows it offers whether or not anything is underway.
  it('does not read a pending flow on a signed in reading as a step to go to', () => {
    const status: AuthStatus = {
      ...authenticated(),
      flows: [{ id: FlowId.reauthenticate, is_pending: true }],
      pendingFlow: { id: FlowId.reauthenticate, is_pending: true },
    }
    chai.expect(determineAuthChangeEvent(authenticated(), status)).to.equal(null)
  })
})
