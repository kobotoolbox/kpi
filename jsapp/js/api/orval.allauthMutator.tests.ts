var mockedGetCsrfToken: jest.Mock
jest.mock('#/utils', () => {
  mockedGetCsrfToken = jest.fn()
  return { getCsrfToken: mockedGetCsrfToken }
})

jest.mock('./ServerError', () => {
  return {
    ServerError: {
      new: jest.fn().mockImplementation(async (response: Response) => {
        const err = Object.assign(new Error(`${response.status}`), { response })
        return err
      }),
    },
  }
})

import { fetchAllauth } from './orval.allauthMutator'

function makeResponse(status: number, body: unknown, contentType = 'application/json') {
  return Promise.resolve(
    new Response(body !== null ? JSON.stringify(body) : null, {
      status,
      headers: contentType ? { 'Content-Type': contentType } : {},
    }),
  )
}

describe('fetchAllauth', () => {
  let fetchSpy: jest.SpyInstance

  beforeEach(() => {
    fetchSpy = jest.spyOn(global, 'fetch')
    mockedGetCsrfToken.mockReturnValue('test-csrf')
  })

  afterEach(() => {
    fetchSpy.mockRestore()
  })

  it('returns 401 as data instead of throwing', async () => {
    fetchSpy.mockReturnValue(makeResponse(401, { detail: 'Unauthorized' }))

    const result = await fetchAllauth<{ status: number; data: unknown }>('/api/v2/allauth/browser/v1/auth/session', {
      method: 'DELETE',
    })

    chai.expect(result.status).to.equal(401)
    chai.expect(result.data).to.deep.equal({ detail: 'Unauthorized' })
  })

  it('returns 200 response as data', async () => {
    fetchSpy.mockReturnValue(makeResponse(200, { meta: { is_authenticated: true } }))

    const result = await fetchAllauth<{ status: number; data: unknown }>('/api/v2/allauth/browser/v1/auth/session', {
      method: 'GET',
    })

    chai.expect(result.status).to.equal(200)
    chai.expect(result.data).to.deep.equal({ meta: { is_authenticated: true } })
  })

  it('returns empty object as data for 204 No Content', async () => {
    fetchSpy.mockReturnValue(Promise.resolve(new Response(null, { status: 204 })))

    const result = await fetchAllauth<{ status: number; data: unknown }>('/api/v2/allauth/browser/v1/auth/session', {
      method: 'DELETE',
    })

    chai.expect(result.status).to.equal(204)
    chai.expect(result.data).to.deep.equal({})
  })

  it('includes CSRF token for non-GET requests', async () => {
    mockedGetCsrfToken.mockReturnValue('csrf-abc123')
    fetchSpy.mockReturnValue(makeResponse(200, {}))

    await fetchAllauth('/api/v2/allauth/browser/v1/auth/login', { method: 'POST' })

    const headers = fetchSpy.mock.calls[0][1].headers
    chai.expect(headers['X-CSRFToken']).to.equal('csrf-abc123')
  })

  it('does not include CSRF token for GET requests', async () => {
    fetchSpy.mockReturnValue(makeResponse(200, {}))

    await fetchAllauth('/api/v2/allauth/browser/v1/auth/session', { method: 'GET' })

    const headers = fetchSpy.mock.calls[0][1].headers
    chai.expect(headers['X-CSRFToken']).to.equal(undefined)
  })

  it('throws on 5xx responses', async () => {
    fetchSpy.mockReturnValue(makeResponse(500, { detail: 'Internal Server Error' }))

    let threw = false
    try {
      await fetchAllauth('/api/v2/allauth/browser/v1/auth/session', { method: 'GET' })
    } catch (err) {
      threw = true
      chai.expect((err as Error).message).to.equal('500')
    }
    chai.expect(threw).to.equal(true)
  })

  it('propagates network-level errors', async () => {
    fetchSpy.mockReturnValue(Promise.reject(new TypeError('Failed to fetch')))

    let threw = false
    try {
      await fetchAllauth('/api/v2/allauth/browser/v1/auth/session', { method: 'GET' })
    } catch (err) {
      threw = true
      chai.expect(err).to.be.instanceof(TypeError)
      chai.expect((err as TypeError).message).to.equal('Failed to fetch')
    }
    chai.expect(threw).to.equal(true)
  })
})
