// Jest needs the mock defined before any imports, and `var` avoids the hoisting
// ReferenceError. We only mock `notify` - the handler imports nothing else from utils.
var mockedNotify: jest.Mock
jest.mock('#/utils', () => {
  mockedNotify = jest.fn()
  return { notify: mockedNotify }
})

import chai from 'chai'
import { ServerError } from './ServerError'
import { onErrorDefaultHandler } from './onErrorDefaultHandler'

/** Mirrors how `ServerError.new()` derives `detail` from a parsed response body. */
function makeServerError(status: number, statusText: string, body: unknown) {
  const response = { status, statusText } as Response
  const detail =
    typeof body === 'object' && body !== null && 'detail' in body ? (body as { detail: unknown }).detail : undefined
  return new ServerError(response, detail, body)
}

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

  it("displays backend's `error` key when there is no `detail`", () => {
    handleAsMutation(
      makeServerError(400, 'Bad Request', { error: 'Export task for user access logs already in progress.' }),
    )

    chai.expect(mockedNotify.mock.calls[0][0]).to.equal('Export task for user access logs already in progress.')
  })

  // Regression guard for DEV-1218: DRF keys `validate_<field>()` errors under the
  // field name. Such a body carries no displayable message, and we must not fall
  // back to stringifying the error - that surfaced a bare "400 Bad Request".
  it('falls back to a generic message for a field-keyed body, not the HTTP status', () => {
    handleAsMutation(makeServerError(400, 'Bad Request', { status: ['Invitation cannot be resent'] }))

    chai.expect(mockedNotify.mock.calls[0][0]).to.equal('An error occurred')
    chai.expect(mockedNotify.mock.calls[0][0]).to.not.contain('400')
  })

  it('falls back to a generic message when the response has no body', () => {
    handleAsMutation(makeServerError(500, 'Internal Server Error', undefined))

    chai.expect(mockedNotify.mock.calls[0][0]).to.equal('An error occurred')
    chai.expect(mockedNotify.mock.calls[0][0]).to.not.contain('500')
  })

  it('keeps the raw error in the console argument so debugging survives the fallback', () => {
    handleAsMutation(makeServerError(500, 'Internal Server Error', undefined))

    // 4th argument of notify() is the console-only message.
    chai.expect(mockedNotify.mock.calls[0][3]).to.contain('500 Internal Server Error')
  })

  it('stays silent when the user aborted the request', () => {
    handleAsMutation(new DOMException('The user aborted a request.', 'AbortError'))

    chai.expect(mockedNotify.mock.calls.length).to.equal(0)
  })
})
