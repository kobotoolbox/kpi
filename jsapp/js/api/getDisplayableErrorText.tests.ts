import chai from 'chai'
import { containsHtmlMarkup, getDisplayableErrorText } from './getDisplayableErrorText'

/** What Django serves for a 500 in production (see `kpi/templates/custom_500.html`). */
const DJANGO_500_PAGE = `<!DOCTYPE html>
<html lang="en">
  <head><title>KoboToolbox</title></head>
  <body><h1>Server error (500)</h1>Something went wrong.</body>
</html>`

/**
 * We send `Accept: application/json`, so Django's 500 handler skips the HTML page and returns the traceback as plain
 * text. There's no markup here to sniff for.
 */
const DJANGO_TEXT_TRACEBACK = `Internal Server Error: /api/v2/assets/aBcDeFgH/
Traceback (most recent call last):
  File "/srv/src/kpi/kpi/views/v2/asset.py", line 322, in list
TypeError: 'NoneType' object is not subscriptable`

describe('getDisplayableErrorText', () => {
  it('rejects error-page output', () => {
    chai.expect(getDisplayableErrorText(DJANGO_500_PAGE, 500)).to.equal(null)
    // The old sniff needed both `</html>` and `</body>`, so anything partial - a truncated response, a proxy's snippet
    // - went straight to the toast.
    chai.expect(getDisplayableErrorText('<h1>Bad Request</h1><p>Check your input', 400)).to.equal(null)
  })

  it('rejects any 5xx body, with or without markup in it', () => {
    chai.expect(getDisplayableErrorText(DJANGO_TEXT_TRACEBACK, 500)).to.equal(null)
    chai.expect(getDisplayableErrorText('upstream connect error', 503)).to.equal(null)
  })

  it('rejects markup on a 4xx, which the status check alone would miss', () => {
    chai.expect(getDisplayableErrorText(DJANGO_500_PAGE, 403)).to.equal(null)
  })

  it('passes backend copy through, trimmed', () => {
    chai
      .expect(getDisplayableErrorText('Please try again after 5 seconds\n', 429))
      .to.equal('Please try again after 5 seconds')
    chai.expect(getDisplayableErrorText('Invitation cannot be resent')).to.equal('Invitation cannot be resent')
    // JSON is `flattenErrorBody`'s job, so it goes through untouched.
    chai.expect(getDisplayableErrorText('{"detail":"Not found."}', 404)).to.equal('{"detail":"Not found."}')
  })

  it('keeps messages that merely contain angle brackets', () => {
    // Why the sniff is an allowlist of tag names, and not a parser or `/<[^>]+>/`: an HTML parser reads all three
    // of these as markup.
    chai.expect(getDisplayableErrorText('Value must be < 5', 400)).to.equal('Value must be < 5')
    chai.expect(getDisplayableErrorText('user <a@b.com> was not found', 400)).to.equal('user <a@b.com> was not found')
    chai
      .expect(getDisplayableErrorText('Unknown question <group_name/repeat>', 400))
      .to.equal('Unknown question <group_name/repeat>')
  })

  it('returns null when there is nothing to show', () => {
    chai.expect(getDisplayableErrorText('', 500)).to.equal(null)
    chai.expect(getDisplayableErrorText('   \n  ', 400)).to.equal(null)
    chai.expect(getDisplayableErrorText(undefined, 400)).to.equal(null)
    chai.expect(getDisplayableErrorText({ detail: 'Not found.' }, 404)).to.equal(null)
  })

  it('spots markup anywhere in a string, for the `notify()` backstop', () => {
    chai.expect(containsHtmlMarkup('Server said: <div class="error">nope</div>')).to.equal(true)
    chai.expect(containsHtmlMarkup(DJANGO_TEXT_TRACEBACK)).to.equal(false)
  })
})
