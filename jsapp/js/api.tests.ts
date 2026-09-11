// Jest needs the mocks defined before any imports, and `var` avoids the hoisting ReferenceError. `handleApiFail` only
// needs `notify` out of utils, but the module is mocked whole, so `getCsrfToken` has to be stubbed too.
var mockedNotifyError: jest.Mock
var mockedCaptureMessage: jest.Mock
jest.mock('#/utils', () => {
  mockedNotifyError = jest.fn()
  return { notify: { error: mockedNotifyError }, getCsrfToken: () => undefined }
})
jest.mock('@sentry/react', () => {
  mockedCaptureMessage = jest.fn()
  return { captureMessage: mockedCaptureMessage }
})

import chai from 'chai'
import { handleApiFail } from '#/api'
import type { FailResponse } from '#/dataInterface'

/** Shortened, but structurally what Django serves for a 500 in production. */
const DJANGO_500_PAGE =
  '<!DOCTYPE html><html><head><title>KoboToolbox</title></head>' +
  '<body><h1>Server error (500)</h1>Something went wrong.</body></html>'

/** What `runserver_plus` serves in development, cut down to the part we pluck. */
const WERKZEUG_DEBUGGER_PAGE =
  '<!DOCTYPE HTML><html><head><title>TypeError // Werkzeug Debugger</title></head>' +
  '<body><div class="detail"><p class="errormsg">TypeError: unsupported operand</p></div></body></html>'

function failResponse(status: number, statusText: string, responseText?: string): FailResponse {
  return { status, statusText, responseText } as FailResponse
}

/** First argument of `notify.error()` - what the user reads. */
const toastMessage = () => mockedNotifyError.mock.calls[0][0]
/** Third argument of `notify.error()` - console only. */
const consoleMessage = () => mockedNotifyError.mock.calls[0][2]

describe('handleApiFail', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // The docstring always claimed this happened, the code never did it: it only looked for Werkzeug's `.errormsg`, so
  // a production error page fell through to the toast as raw markup.
  it('replaces an error page with a generic message, but keeps it in the console', () => {
    handleApiFail(failResponse(500, 'Internal Server Error', DJANGO_500_PAGE))

    chai.expect(toastMessage()).to.equal('An error occurred')
    chai.expect(consoleMessage()).to.contain('500 Internal Server Error')
    chai.expect(consoleMessage()).to.contain('Server error (500)')
  })

  it('reports a stable title to Sentry and carries the body as extra data', () => {
    handleApiFail(failResponse(500, 'Internal Server Error', DJANGO_500_PAGE))

    // A page body as the title gives Sentry one issue per occurrence.
    chai.expect(mockedCaptureMessage.mock.calls[0][0]).to.equal('500 Internal Server Error')
    chai.expect(mockedCaptureMessage.mock.calls[0][1].extra.responseText).to.equal(DJANGO_500_PAGE)
  })

  it("plucks the Werkzeug debugger's message in development, as text and not markup", () => {
    handleApiFail(failResponse(500, 'Internal Server Error', WERKZEUG_DEBUGGER_PAGE))

    chai.expect(toastMessage()).to.equal('TypeError: unsupported operand')
  })

  it('shows backend copy, from the parsed body first and the raw text otherwise', () => {
    const parsed = failResponse(400, 'Bad Request')
    parsed.responseJSON = { name: ['This field is required.'] }
    handleApiFail(parsed)
    chai.expect(toastMessage()).to.equal('name: This field is required.')

    jest.clearAllMocks()
    handleApiFail(failResponse(404, 'Not Found', '{"detail":"The submission could not be found"}'))
    chai.expect(toastMessage()).to.equal('The submission could not be found')
  })

  it("prefers the caller's message over anything from the backend", () => {
    handleApiFail(failResponse(404, 'Not Found', 'The submission could not be found'), 'Failed to accept invite.')

    chai.expect(toastMessage()).to.equal('Failed to accept invite.')
  })

  // `.fail(handleApiFail)` hands us jQuery's `textStatus` as the second argument, which used to win over everything and
  // put "parsererror" or plain "error" in the toast.
  it("ignores jQuery's textStatus when passed as the message", () => {
    handleApiFail(failResponse(200, 'OK', DJANGO_500_PAGE), 'parsererror')

    chai.expect(toastMessage()).to.equal('An error occurred')
  })

  it('falls back to a generic message when there is no body at all', () => {
    handleApiFail(failResponse(500, 'Internal Server Error'))

    chai.expect(toastMessage()).to.equal('An error occurred')
  })

  it('stays quiet for a request we aborted ourselves', () => {
    handleApiFail(failResponse(0, 'abort'))

    chai.expect(mockedNotifyError.mock.calls.length).to.equal(0)
    chai.expect(mockedCaptureMessage.mock.calls.length).to.equal(0)
  })
})
