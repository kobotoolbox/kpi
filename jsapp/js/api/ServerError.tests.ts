import chai from 'chai'
import { ServerError } from './ServerError'

/** `ServerError.new()` only reads `status`, `statusText` and `text()` off the response. */
const fakeResponse = (status: number, statusText: string, body: string) =>
  ({ status, statusText, text: async () => body }) as unknown as Response

describe('ServerError.new', () => {
  it('keeps a plain-text message in `detail`, but not error page output', async () => {
    const message = await ServerError.new(fakeResponse(429, 'Too Many Requests', 'Please try again after 5 seconds'))
    chai.expect(message.detail).to.equal('Please try again after 5 seconds')

    // Components render `detail` straight into the UI, so a page must not reach it. The body stays on
    // `parsedResponse` for logging.
    const page = await ServerError.new(
      fakeResponse(500, 'Internal Server Error', '<html><body><h1>Server error (500)</h1></body></html>'),
    )
    chai.expect(page.detail).to.equal(null)
    chai.expect(page.parsedResponse).to.contain('Server error (500)')
    chai.expect(page.toString()).to.equal('500 Internal Server Error')
  })
})
