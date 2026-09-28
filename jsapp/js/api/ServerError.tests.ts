import chai from 'chai'
import { ServerError } from './ServerError'

/** `ServerError.new()` only reads `status`, `statusText` and `text()` off the response. */
const fakeResponse = (status: number, statusText: string, body: string) =>
  ({ status, statusText, text: async () => body }) as unknown as Response

describe('ServerError.new', () => {
  it('fills `detail` from a JSON body, and leaves it empty for anything else', async () => {
    const json = await ServerError.new(fakeResponse(429, 'Too Many Requests', '{"detail":"Try again in 5 seconds"}'))
    chai.expect(json.detail).to.equal('Try again in 5 seconds')

    // Components render `detail` straight into the UI, so a page must not reach it. The body stays on
    // `parsedResponse` for logging.
    const page = await ServerError.new(
      fakeResponse(500, 'Internal Server Error', '<html><body><h1>Server error (500)</h1></body></html>'),
    )
    chai.expect(page.detail).to.equal(undefined)
    chai.expect(page.parsedResponse).to.contain('Server error (500)')
    chai.expect(page.toString()).to.equal('500 Internal Server Error')
  })
})
