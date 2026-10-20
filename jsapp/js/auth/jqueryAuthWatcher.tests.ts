import chai from 'chai'
import $ from 'jquery'
import { queryClient } from '#/api/queryClient'
import { getAuthStatusQueryKey } from './authChangeWatcher'
import { watchJqueryResponses } from './jqueryAuthWatcher'

const queryKey = getAuthStatusQueryKey()
/** An asset load: a KPI endpoint, and the kind of call that still goes through jQuery. */
const assetUrl = '/api/v2/assets/aXy5nQ2vFmW8pLr3TkJdHc/'
/** The situation being fixed: the cache says somebody is signed in, and the server is about to disagree. */
const signedIn = { status: 200, data: { meta: { is_authenticated: true } } }

const isSessionReadingStale = () => queryClient.getQueryState(queryKey)?.isInvalidated

/** The whole of `XMLHttpRequest` that jQuery's transport touches. */
interface FakeXhr {
  status: number
  statusText: string
  responseText: string
  onload: (() => void) | null
  open(): void
  setRequestHeader(): void
  getAllResponseHeaders(): string
  abort(): void
  send(): void
}

/** An `$.ajaxSettings.xhr` factory answering with `status` and `body` instead of reaching a server. */
function fakeXhr(status: number, body: unknown) {
  return () => {
    const xhr: FakeXhr = {
      status,
      statusText: 'Unauthorized',
      responseText: JSON.stringify(body),
      onload: null,
      open: () => {},
      setRequestHeader: () => {},
      getAllResponseHeaders: () => 'content-type: application/json',
      abort: () => {},
      // jQuery assigns `onload` before it sends, so answering from inside `send` keeps the whole call synchronous
      send: () => xhr.onload?.(),
    }
    return xhr as unknown as XMLHttpRequest
  }
}

/**
 * Makes one real `$.ajax` call, answered with `status` and `body`, and waits for it to settle.
 *
 * Going through `$.ajax` rather than triggering `ajaxError` by hand is the point of these tests: triggering it would
 * assert nothing beyond the argument order this file picked. What is worth checking is that jQuery hands a failure to
 * the watcher at all, and that it has parsed `responseJSON` by the time it does.
 */
async function callAnsweredWith(status: number, body: unknown) {
  $.ajaxSetup({ xhr: fakeXhr(status, body) })
  await $.ajax({ url: assetUrl, dataType: 'json' }).catch(() => null)
}

describe('watchJqueryResponses', () => {
  const originalXhr = $.ajaxSettings.xhr

  beforeAll(() => {
    watchJqueryResponses()
  })

  afterAll(() => {
    // Neither one undoes itself, and both are global to jQuery
    $(document).off('ajaxError')
    $.ajaxSetup({ xhr: originalXhr })
  })

  beforeEach(() => {
    queryClient.removeQueries({ queryKey })
    // A reading to invalidate: while the query is absent there is nothing to mark, and nothing to assert on
    queryClient.setQueryData(queryKey, signedIn)
  })

  it('invalidates the session reading when a jQuery call comes back 401', async () => {
    await callAnsweredWith(401, { detail: 'Invalid token.' })

    chai.expect(isSessionReadingStale()).to.equal(true)
  })

  // The ask arrives in the body, so the watcher can only spot it if jQuery has parsed one by now
  it('leaves the reading alone when the 401 is a reauthentication ask', async () => {
    await callAnsweredWith(401, { meta: { is_authenticated: true } })

    chai.expect(isSessionReadingStale()).to.equal(false)
  })

  it('leaves the reading alone for a failure that says nothing about the session', async () => {
    await callAnsweredWith(403, { detail: 'You do not have permission.' })

    chai.expect(isSessionReadingStale()).to.equal(false)
  })
})
