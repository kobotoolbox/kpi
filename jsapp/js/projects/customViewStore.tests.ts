import chai from 'chai'
import customViewStore from './customViewStore'
import { HOME_DEFAULT_VISIBLE_FIELDS } from './projectViews/constants'

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
})
