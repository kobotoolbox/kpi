import chai from 'chai'
import { fetchGet } from '#/api'
import { fetchWithAuth } from '#/api/orval.mutator'
import { queryClient } from '#/api/queryClient'
import {
  allauthBrowserV1AccountPasswordChangePost,
  getAllauthBrowserV1AuthSessionGetQueryKey,
  getAllauthBrowserV1AuthSessionGetUrl,
} from '#/api/react-query/authentication-allauth-headless'
import type { AllauthResponse } from './allauthErrors'
import {
  ALLAUTH_BASE_URL,
  AUTH_STATUS_URL,
  getAuthStatusQueryKey,
  isAuthChangeResponse,
  isSessionEndedResponse,
  recordAllauthResponse,
  recordApiResponse,
} from './authChangeWatcher'
import { getAuthStatus } from './authStatus'

const user = { id: 7, display: 'sallyride', username: 'sallyride', has_usable_password: true }

/** As `fetchAllauth` hands it over: allauth's own body nested under `data`. */
const response = (status: number, body: unknown = {}): AllauthResponse => ({ status, data: body })

/** As the server sends it, for the tests that go through `fetchAllauth` rather than around it. */
const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const session = response(200, { data: { user, methods: [{ method: 'password' }] }, meta: { is_authenticated: true } })
const anonymous = response(401, { data: { flows: [{ id: 'login' }] }, meta: { is_authenticated: false } })
const reauthenticationRequired = response(401, {
  data: { user, methods: [{ method: 'password' }], flows: [{ id: 'reauthenticate', is_pending: true }] },
  meta: { is_authenticated: true },
})

const sessionUrl = getAllauthBrowserV1AuthSessionGetUrl()
/** The kind of request that raises a reauthentication ask, and the kind the session poll can race. */
const fromAccountCall = { url: '/api/v2/allauth/browser/v1/account/password/change', method: 'POST' }
/** An asset, a project list, a submission: a KPI endpoint, which has no use for a 401 other than "no session". */
const assetUrl = '/api/v2/assets/aXy5nQ2vFmW8pLr3TkJdHc/'

const queryKey = getAuthStatusQueryKey()

/**
 * Empties the session query, optionally leaving one reading behind. The invalidation tests need that reading: while
 * the query is absent there is nothing for `invalidateQueries` to mark, and nothing to assert on.
 */
function resetSessionReading(reading?: AllauthResponse) {
  queryClient.removeQueries({ queryKey })
  if (reading) {
    queryClient.setQueryData(queryKey, reading)
  }
}

const isSessionReadingStale = () => queryClient.getQueryState(queryKey)?.isInvalidated

// Both hand-written to keep `fetchAllauth` out of an import cycle, so this is what catches orval moving the endpoint.
describe('the session query`s key and URL', () => {
  it('are the ones the generated session query uses', () => {
    chai.expect(getAuthStatusQueryKey()).to.deep.equal(getAllauthBrowserV1AuthSessionGetQueryKey())
    chai.expect(AUTH_STATUS_URL).to.equal(sessionUrl)
  })

  it('sit under the allauth base that `isSessionEndedResponse` excludes', () => {
    chai.expect(AUTH_STATUS_URL.startsWith(ALLAUTH_BASE_URL)).to.equal(true)
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
    resetSessionReading()
  })

  it('files a session where the guards and `AuthChangeRedirector` read it', async () => {
    await recordAllauthResponse(fromAccountCall, session)

    const cached = queryClient.getQueryData(queryKey) as AllauthResponse
    chai.expect(getAuthStatus(cached).isAuthenticated).to.equal(true)
    chai.expect(getAuthStatus(cached).user).to.deep.equal(user)
  })

  // The point of the whole module: this pair comes back from the sensitive request, never from `GET /auth/session`.
  it('files a reauthentication ask from whichever endpoint raised it', async () => {
    await recordAllauthResponse(fromAccountCall, session)
    await recordAllauthResponse(fromAccountCall, reauthenticationRequired)

    const cached = queryClient.getQueryData(queryKey) as AllauthResponse
    chai.expect(getAuthStatus(cached).isReauthenticationRequired).to.equal(true)
  })

  it('leaves the last reading in place when the answer is not one', async () => {
    await recordAllauthResponse(fromAccountCall, session)
    await recordAllauthResponse(fromAccountCall, response(400, { errors: [{ message: 'Wrong password.' }] }))

    const cached = queryClient.getQueryData(queryKey) as AllauthResponse
    chai.expect(cached.status).to.equal(200)
  })

  it('writes nothing at all when it has never seen a reading', async () => {
    await recordAllauthResponse(fromAccountCall, response(400, {}))

    chai.expect(queryClient.getQueryData(queryKey)).to.equal(undefined)
  })

  // Cancelling would abort the very request whose answer this is, leaving the query reverted on every poll.
  it('leaves the session query alone when the answer is that query`s own', async () => {
    const cancelSpy = jest.spyOn(queryClient, 'cancelQueries')

    await recordAllauthResponse({ url: `${sessionUrl}?x=1`, method: 'GET' }, session)
    chai.expect(cancelSpy.mock.calls).to.have.length(0)

    // Signing out is a `DELETE` on the same URL, and nothing else reports it
    await recordAllauthResponse({ url: sessionUrl, method: 'DELETE' }, anonymous)
    chai.expect(cancelSpy.mock.calls).to.have.length(1)

    cancelSpy.mockRestore()
  })
})

// Unmocked, so this is also what says the whole chain is wired: generated client → `fetchAllauth` → here.
describe('an allauth call from a screen other than the session poll', () => {
  let fetchSpy: jest.SpyInstance

  beforeEach(() => {
    resetSessionReading()
    fetchSpy = jest.spyOn(global, 'fetch')
  })

  afterEach(() => {
    fetchSpy.mockRestore()
  })

  it('leaves its answer as the newest session reading', async () => {
    fetchSpy.mockResolvedValue(jsonResponse(401, reauthenticationRequired.data))

    await allauthBrowserV1AccountPasswordChangePost({ current_password: 'hunter2', new_password: 'hunter3' })

    const cached = queryClient.getQueryData(queryKey) as AllauthResponse
    chai.expect(getAuthStatus(cached).isReauthenticationRequired).to.equal(true)
  })
})

describe('isSessionEndedResponse', () => {
  const unauthorized = (url: string, body?: unknown) => ({ url, status: 401, body })

  it('takes a 401 from anywhere outside allauth', () => {
    chai.expect(isSessionEndedResponse(unauthorized(assetUrl))).to.equal(true)
    // `api.ts` and `dataInterface` both prepend `ROOT_URL`, which carries the protocol, the host and any root path
    chai.expect(isSessionEndedResponse(unauthorized(`https://kf.example.org/kpi${assetUrl}`))).to.equal(true)
  })

  // A re-read would land on top of what the call itself just reported, and would again on the next one
  it('leaves allauth`s own 401s alone, as those are data rather than a sign-out', () => {
    chai.expect(isSessionEndedResponse(unauthorized(sessionUrl))).to.equal(false)
    chai.expect(isSessionEndedResponse(unauthorized(`${sessionUrl}?x=1`))).to.equal(false)
    chai.expect(isSessionEndedResponse(unauthorized(fromAccountCall.url))).to.equal(false)
  })

  // The session is real, and `GET /auth/session` has no way to repeat the ask, so a re-read would lose it
  it('leaves a reauthentication ask alone', () => {
    chai.expect(isSessionEndedResponse(unauthorized(assetUrl, reauthenticationRequired.data))).to.equal(false)
  })

  it('leaves every other status alone', () => {
    // A 403 is a permission refusal, which signing in again is no answer to
    chai.expect(isSessionEndedResponse({ url: assetUrl, status: 403 })).to.equal(false)
    chai.expect(isSessionEndedResponse({ url: assetUrl, status: 404 })).to.equal(false)
    chai.expect(isSessionEndedResponse({ url: assetUrl, status: 500 })).to.equal(false)
    // What jQuery reports for a request we aborted, or one the connection dropped
    chai.expect(isSessionEndedResponse({ url: assetUrl, status: 0 })).to.equal(false)
  })
})

describe('recordApiResponse', () => {
  beforeEach(() => {
    resetSessionReading(session)
  })

  it('marks the session reading stale when a 401 says it is wrong', () => {
    recordApiResponse({ url: assetUrl, status: 401 })

    chai.expect(isSessionReadingStale()).to.equal(true)
  })

  it('leaves the reading alone for an answer that proves nothing', () => {
    recordApiResponse({ url: assetUrl, status: 403 })
    recordApiResponse({ url: sessionUrl, status: 401 })
    recordApiResponse({ url: assetUrl, status: 401, body: reauthenticationRequired.data })

    chai.expect(isSessionReadingStale()).to.equal(false)
  })

  // Dropping it instead would leave every guard answerless for the length of one request, which means a spinner
  // over a page that was fine a moment ago
  it('keeps the stale reading readable until the re-read lands', () => {
    recordApiResponse({ url: assetUrl, status: 401 })

    chai.expect(queryClient.getQueryData(queryKey)).to.deep.equal(session)
  })
})

// Unmocked again, so these say the transports are wired and not just that the policy above is right.
describe('a 401 from a KPI endpoint', () => {
  let fetchSpy: jest.SpyInstance

  beforeEach(() => {
    resetSessionReading(session)
    fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(jsonResponse(401, { detail: 'Invalid token.' }))
  })

  afterEach(() => {
    fetchSpy.mockRestore()
  })

  it('invalidates the session reading when it arrives through the Orval mutator', async () => {
    await fetchWithAuth(assetUrl, { method: 'GET' }).catch(() => null)

    chai.expect(isSessionReadingStale()).to.equal(true)
  })

  // `notifyAboutError` only to keep a toast out of a unit test - it has no say in any of this
  it('invalidates the session reading when it arrives through `#/api`', async () => {
    await fetchGet(assetUrl, { notifyAboutError: false }).catch(() => null)

    chai.expect(isSessionReadingStale()).to.equal(true)
  })
})
