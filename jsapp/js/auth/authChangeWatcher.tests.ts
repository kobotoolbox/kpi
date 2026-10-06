import chai from 'chai'
import { queryClient } from '#/api/queryClient'
import {
  allauthBrowserV1AccountPasswordChangePost,
  getAllauthBrowserV1AuthSessionGetQueryKey,
} from '#/api/react-query/authentication-allauth-headless'
import type { AllauthResponse } from './allauthErrors'
import { getAuthStatusQueryKey, isAuthChangeResponse, recordAllauthResponse } from './authChangeWatcher'
import { getAuthStatus } from './authStatus'

const user = { id: 7, display: 'sallyride', username: 'sallyride', has_usable_password: true }

/** As `fetchAllauth` hands it over: allauth's own body nested under `data`. */
const response = (status: number, body: unknown = {}): AllauthResponse => ({ status, data: body })

const session = response(200, { data: { user, methods: [{ method: 'password' }] }, meta: { is_authenticated: true } })
const anonymous = response(401, { data: { flows: [{ id: 'login' }] }, meta: { is_authenticated: false } })
const reauthenticationRequired = response(401, {
  data: { user, methods: [{ method: 'password' }], flows: [{ id: 'reauthenticate', is_pending: true }] },
  meta: { is_authenticated: true },
})

describe('getAuthStatusQueryKey', () => {
  // Hand-written to keep `fetchAllauth` out of an import cycle, so this is what catches orval moving the endpoint.
  it('is the key the generated session query uses', () => {
    chai.expect(getAuthStatusQueryKey()).to.deep.equal(getAllauthBrowserV1AuthSessionGetQueryKey())
  })
})

describe('isAuthChangeResponse', () => {
  it('takes a session', () => {
    chai.expect(isAuthChangeResponse(session)).to.equal(true)
  })

  it('takes every 401, signed in or not', () => {
    chai.expect(isAuthChangeResponse(anonymous)).to.equal(true)
    chai.expect(isAuthChangeResponse(reauthenticationRequired)).to.equal(true)
    // The logout answer, and whatever an `/account/*` call gets without a session
    chai.expect(isAuthChangeResponse(response(401))).to.equal(true)
  })

  it('takes a 410, which only an `app` client ever sees', () => {
    chai.expect(isAuthChangeResponse(response(410, { meta: { is_authenticated: false } }))).to.equal(true)
  })

  // `GET /config`, or a list of email addresses or authenticators: a 200 about something other than the session.
  it('leaves a 200 that says nothing about a session alone', () => {
    chai.expect(isAuthChangeResponse(response(200, { data: [{ email: 'sally@example.org' }] }))).to.equal(false)
  })

  // Not a thing allauth sends, and `getAuthStatus` would read it as the opposite of what it says.
  it('leaves a 200 claiming no session alone', () => {
    chai.expect(isAuthChangeResponse(response(200, { meta: { is_authenticated: false } }))).to.equal(false)
  })

  it('leaves the statuses allauth uses for a refusal alone', () => {
    chai.expect(isAuthChangeResponse(response(400, { errors: [{ message: 'Wrong password.' }] }))).to.equal(false)
    chai.expect(isAuthChangeResponse(response(403))).to.equal(false)
    chai.expect(isAuthChangeResponse(response(409))).to.equal(false)
    // No content, so nothing to read a session out of
    chai.expect(isAuthChangeResponse(response(204))).to.equal(false)
  })
})

describe('recordAllauthResponse', () => {
  beforeEach(() => {
    queryClient.removeQueries({ queryKey: getAuthStatusQueryKey() })
  })

  it('files a session where the guards and `AuthChangeRedirector` read it', () => {
    recordAllauthResponse(session)

    const cached = queryClient.getQueryData(getAuthStatusQueryKey()) as AllauthResponse
    chai.expect(getAuthStatus(cached).isAuthenticated).to.equal(true)
    chai.expect(getAuthStatus(cached).user).to.deep.equal(user)
  })

  // The point of the whole module: this pair comes back from the sensitive request, never from `GET /auth/session`.
  it('files a reauthentication ask from whichever endpoint raised it', () => {
    recordAllauthResponse(session)
    recordAllauthResponse(reauthenticationRequired)

    const cached = queryClient.getQueryData(getAuthStatusQueryKey()) as AllauthResponse
    chai.expect(getAuthStatus(cached).isReauthenticationRequired).to.equal(true)
  })

  it('leaves the last reading in place when the answer is not one', () => {
    recordAllauthResponse(session)
    recordAllauthResponse(response(400, { errors: [{ message: 'Wrong password.' }] }))

    const cached = queryClient.getQueryData(getAuthStatusQueryKey()) as AllauthResponse
    chai.expect(cached.status).to.equal(200)
  })

  it('writes nothing at all when it has never seen a reading', () => {
    recordAllauthResponse(response(400, {}))

    chai.expect(queryClient.getQueryData(getAuthStatusQueryKey())).to.equal(undefined)
  })
})

// Unmocked, so this is also what says the whole chain is wired: generated client → `fetchAllauth` → here.
describe('an allauth call from a screen other than the session poll', () => {
  let fetchSpy: jest.SpyInstance

  beforeEach(() => {
    queryClient.removeQueries({ queryKey: getAuthStatusQueryKey() })
    fetchSpy = jest.spyOn(global, 'fetch')
  })

  afterEach(() => {
    fetchSpy.mockRestore()
  })

  it('leaves its answer as the newest session reading', async () => {
    const body = {
      status: 401,
      data: { user, methods: [{ method: 'password' }], flows: [{ id: 'reauthenticate', is_pending: true }] },
      meta: { is_authenticated: true },
    }
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify(body), { status: 401, headers: { 'Content-Type': 'application/json' } }),
    )

    await allauthBrowserV1AccountPasswordChangePost({ current_password: 'hunter2', new_password: 'hunter3' })

    const cached = queryClient.getQueryData(getAuthStatusQueryKey()) as AllauthResponse
    chai.expect(getAuthStatus(cached).isReauthenticationRequired).to.equal(true)
  })
})
