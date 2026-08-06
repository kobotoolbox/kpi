import chai from 'chai'
import $ from 'jquery'
import customViewStore from './customViewStore'
import { HOME_DEFAULT_VISIBLE_FIELDS } from './projectViews/constants'

/**
 * Replaces `$.ajax` with a stub that records the urls it was asked for and never resolves, so tests can inspect the
 * in-flight state of the store. Returns the recorded urls plus a function that puts the real `$.ajax` back.
 */
function stubAjax() {
  const requestedUrls: string[] = []
  const originalAjax = $.ajax
  // Enough of a jqXHR for the store's chained `.done().fail()` calls, but it never settles - so a "pending" request
  // stays pending for as long as the test needs it to.
  const fakeJqXhr = {
    done() {
      return { fail() {} }
    },
    abort() {},
  }
  ;($ as any).ajax = (settings: { url: string }) => {
    requestedUrls.push(settings.url)
    return fakeJqXhr
  }

  function restore() {
    ;($ as any).ajax = originalAjax
  }

  return { requestedUrls, restore }
}

describe('customViewStore', () => {
  describe('constructFullQueryParams', () => {
    it('includes asset_type filter by default', () => {
      const store = customViewStore.setUp('', '', HOME_DEFAULT_VISIBLE_FIELDS)
      const url = new URL('http://www.example.com')
      const params = customViewStore.constructFullQueryParams(url)
      const paramsObject = Object.fromEntries(params)
      chai
        .expect(paramsObject)
        .to.deep.equal({ q: '(asset_type:survey)', limit: '50', current_user_permissions_only: 'true' })
    })
    it('removes asset_type if includeTypeFilter is false', () => {
      const store = customViewStore.setUp('', '', HOME_DEFAULT_VISIBLE_FIELDS, false)
      const url = new URL('http://www.example.com')
      const params = customViewStore.constructFullQueryParams(url)
      const paramsObject = Object.fromEntries(params)
      chai.expect(paramsObject).to.deep.equal({ limit: '50', current_user_permissions_only: 'true' })
    })
  })

  describe('onFetchMoreAssetsDone', () => {
    it('deduplicates overlapping assets by uid when appending next page', () => {
      const store = customViewStore as any
      store.assets = [{ uid: 'abc123' }, { uid: 'def456' }]

      store.onFetchMoreAssetsDone({
        count: 4,
        next: null,
        previous: 'http://kf.local.kbtdev.org/api/v2/assets/?limit=50&offset=0',
        results: [{ uid: 'def456' }, { uid: 'ghi789' }],
      })

      chai.expect(store.assets.map((asset: any) => asset.uid)).to.deep.equal(['abc123', 'def456', 'ghi789'])
    })
  })

  describe('fetchMoreAssets', () => {
    it('does nothing when there is no next page', () => {
      const store = customViewStore as any
      store.nextPageUrl = null
      store.isLoadingNextPage = false

      store.fetchMoreAssets()

      chai.expect(store.isLoadingNextPage).to.equal(false)
    })

    it('ignores repeated requests while a next page call is already in flight', () => {
      const store = customViewStore as any
      const { requestedUrls, restore } = stubAjax()

      try {
        store.ongoingFetch = undefined
        store.nextPageUrl = 'http://kf.local.kbtdev.org/api/v2/assets/?limit=50&offset=50'
        store.isLoadingNextPage = false

        // The infinite scroll trigger can fire several times before the first page arrives.
        store.fetchMoreAssets()
        store.fetchMoreAssets()
        store.fetchMoreAssets()

        chai.expect(requestedUrls).to.have.lengthOf(1)
        chai.expect(store.isLoadingNextPage).to.equal(true)
      } finally {
        restore()
      }
    })
  })

  describe('fetchAssets', () => {
    it('clears the stale next page url so the infinite scroll trigger cannot ask for a dropped page', () => {
      const store = customViewStore as any
      const { restore } = stubAjax()

      try {
        store.baseUrl = 'http://kf.local.kbtdev.org/api/v2/assets/'
        store.ongoingFetch = undefined
        store.nextPageUrl = 'http://kf.local.kbtdev.org/api/v2/assets/?limit=50&offset=50'
        store.isLoadingNextPage = true
        store.hasNextPageError = true

        store.fetchAssets()

        chai.expect(store.nextPageUrl).to.equal(null)
        chai.expect(store.hasMoreAssets).to.equal(false)
        chai.expect(store.isLoadingNextPage).to.equal(false)
        chai.expect(store.hasNextPageError).to.equal(false)
      } finally {
        restore()
      }
    })
  })

  describe('onFetchMoreAssetsFail', () => {
    it('flags an error so a retry can be offered', () => {
      const store = customViewStore as any
      store.isLoadingNextPage = true
      store.hasNextPageError = false

      store.onFetchMoreAssetsFail({ status: 500, statusText: 'Internal Server Error' })

      chai.expect(store.isLoadingNextPage).to.equal(false)
      chai.expect(store.hasNextPageError).to.equal(true)
    })

    it('does not flag an error for a call we aborted ourselves', () => {
      const store = customViewStore as any
      store.isLoadingNextPage = true
      store.hasNextPageError = false

      store.onFetchMoreAssetsFail({ status: 0, statusText: 'abort' })

      chai.expect(store.isLoadingNextPage).to.equal(false)
      chai.expect(store.hasNextPageError).to.equal(false)
    })
  })
})
