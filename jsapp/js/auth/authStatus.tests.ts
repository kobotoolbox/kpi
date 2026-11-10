import chai from 'chai'
import type { AllauthResponse } from './allauthErrors'
import { ANONYMOUS_AUTH_STATUS, AuthChangeEvent, determineAuthChangeEvent, getAuthStatus } from './authStatus'

const user = { id: 7, display: 'sallyride', username: 'sallyride', has_usable_password: true }
const otherUser = { ...user, id: 8, display: 'marswatney', username: 'marswatney' }

/** As `fetchAllauth` hands it over: allauth's own body nested under `data`. */
const response = (status: number, body: unknown = {}): AllauthResponse => ({ status, data: body })

const authenticated = () =>
  getAuthStatus(response(200, { data: { user, methods: [{ method: 'password' }] }, meta: { is_authenticated: true } }))

const anonymous = () =>
  getAuthStatus(response(401, { data: { flows: [{ id: 'login' }] }, meta: { is_authenticated: false } }))

const reauthenticationRequired = () =>
  getAuthStatus(
    response(401, {
      data: { user, methods: [{ method: 'password' }], flows: [{ id: 'reauthenticate', is_pending: true }] },
      meta: { is_authenticated: true },
    }),
  )

describe('getAuthStatus', () => {
  it('reads a 200 as a session', () => {
    const status = authenticated()
    chai.expect(status.isAuthenticated).to.equal(true)
    chai.expect(status.user).to.deep.equal(user)
  })

  it('reads a plain 401 as nobody signed in', () => {
    const status = anonymous()
    chai.expect(status.isAuthenticated).to.equal(false)
    chai.expect(status.user).to.equal(null)
  })

  it('reads a 401 that claims a session as still signed in', () => {
    const status = reauthenticationRequired()
    chai.expect(status.isAuthenticated).to.equal(true)
    chai.expect(status.user).to.deep.equal(user)
  })

  it('never reports a user without a session, whatever the body says', () => {
    const status = getAuthStatus(response(401, { data: { user }, meta: { is_authenticated: false } }))
    chai.expect(status.user).to.equal(null)
  })

  it('survives a body with nothing in it', () => {
    chai.expect(getAuthStatus(response(401))).to.deep.equal(ANONYMOUS_AUTH_STATUS)
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

  it('reports a different account as a fresh sign-in, not as no change at all', () => {
    const asOther = getAuthStatus(
      response(200, { data: { user: otherUser, methods: [{ method: 'password' }] }, meta: { is_authenticated: true } }),
    )
    chai.expect(determineAuthChangeEvent(authenticated(), asOther)).to.equal(AuthChangeEvent.loggedIn)
  })

  // A reauthentication ask is answered in place, so it is no change to redirect over
  it('reports nothing when allauth asks for credentials again', () => {
    chai.expect(determineAuthChangeEvent(authenticated(), reauthenticationRequired())).to.equal(null)
    chai.expect(determineAuthChangeEvent(reauthenticationRequired(), authenticated())).to.equal(null)
  })
})
