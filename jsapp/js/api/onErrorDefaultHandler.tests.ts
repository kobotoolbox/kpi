// Jest needs the mock defined before any imports, and `var` avoids the hoisting ReferenceError. We only mock `notify`
// - the handler imports nothing else from utils.
var mockedNotify: jest.Mock
jest.mock('#/utils', () => {
  mockedNotify = jest.fn()
  return { notify: mockedNotify }
})

import chai from 'chai'
import { ServerError } from './ServerError'
import { onErrorDefaultHandler } from './onErrorDefaultHandler'

/**
 * Mirrors how `ServerError.new()` derives `detail` from a response body: a string body is one that failed
 * `JSON.parse()`, and it lands in both fields.
 */
function makeServerError(status: number, statusText: string, body: unknown) {
  const response = { status, statusText } as Response
  let detail: unknown
  if (typeof body === 'string') {
    detail = body
  } else if (typeof body === 'object' && body !== null && 'detail' in body) {
    detail = (body as { detail: unknown }).detail
  }
  return new ServerError(response, detail, body)
}

/** Shortened, but structurally what Django serves for a 500 in production. */
const DJANGO_500_PAGE =
  '<!DOCTYPE html><html><head><title>KoboToolbox</title></head>' +
  '<body><h1>Server error (500)</h1>Something went wrong.</body></html>'

/** The handler's mutation overload takes (error, variables, context). */
function handleAsMutation(error: any) {
  onErrorDefaultHandler(error, undefined, undefined)
}

describe('onErrorDefaultHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("displays backend's `detail` verbatim", () => {
    handleAsMutation(makeServerError(400, 'Bad Request', { detail: 'Invitation cannot be resent' }))

    chai.expect(mockedNotify.mock.calls.length).to.equal(1)
    chai.expect(mockedNotify.mock.calls[0][0]).to.equal('Invitation cannot be resent')
    chai.expect(mockedNotify.mock.calls[0][1]).to.equal('error')
  })

  // Regression guard for DEV-1218: stringifying a field-keyed body surfaced a bare "400 Bad Request". It used to fall
  // back to the generic message; now `flattenErrorBody` reads it, which is fine as long as the status stays out.
  it('displays a field-keyed body rather than the HTTP status', () => {
    handleAsMutation(makeServerError(400, 'Bad Request', { status: ['Invitation cannot be resent'] }))

    chai.expect(mockedNotify.mock.calls[0][0]).to.equal('status: Invitation cannot be resent')
    chai.expect(mockedNotify.mock.calls[0][0]).to.not.contain('400')
  })

  it('displays a plain-text backend message on a 4xx', () => {
    handleAsMutation(makeServerError(429, 'Too Many Requests', 'Please try again after 5 seconds\n'))

    chai.expect(mockedNotify.mock.calls[0][0]).to.equal('Please try again after 5 seconds')
  })

  // Backend owns error content, and some endpoints answer a 5xx with copy meant for the user - `export_task.py` returns
  // a 503 telling you when to retry. JSON is the tell: only a real view produces it, Django's own pages never do.
  it("displays a backend message that arrived with a 5xx, when it's structured", () => {
    handleAsMutation(
      makeServerError(503, 'Service Unavailable', { error: 'Another export is already in progress. Retry in 8s' }),
    )

    chai.expect(mockedNotify.mock.calls[0][0]).to.equal('Another export is already in progress. Retry in 8s')
  })

  // An unparseable body lands in `parsedResponse` as raw text, and used to be
  // displayed verbatim - a whole error page inside a toast.
  it('replaces error page output with a generic message, but keeps it in the console', () => {
    handleAsMutation(makeServerError(500, 'Internal Server Error', DJANGO_500_PAGE))
    chai.expect(mockedNotify.mock.calls[0][0]).to.equal('An error occurred')
    // 4th argument of notify() is the console-only message.
    chai.expect(mockedNotify.mock.calls[0][3]).to.contain('Server error (500)')

    // We ask for JSON, so a 500 usually arrives as a traceback with no markup in it.
    jest.clearAllMocks()
    handleAsMutation(
      makeServerError(500, 'Internal Server Error', 'Internal Server Error: /api/v2/assets/\nTraceback (most recent'),
    )
    chai.expect(mockedNotify.mock.calls[0][0]).to.equal('An error occurred')
  })

  it('falls back to a generic message when the response has no body', () => {
    handleAsMutation(makeServerError(500, 'Internal Server Error', undefined))

    chai.expect(mockedNotify.mock.calls[0][0]).to.equal('An error occurred')
    chai.expect(mockedNotify.mock.calls[0][0]).to.not.contain('500')
    chai.expect(mockedNotify.mock.calls[0][3]).to.contain('500 Internal Server Error')
  })

  it('stays silent when the user aborted the request', () => {
    handleAsMutation(new DOMException('The user aborted a request.', 'AbortError'))

    chai.expect(mockedNotify.mock.calls.length).to.equal(0)
  })
})
