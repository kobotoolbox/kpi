import { DATA_TABLE_SETTINGS, SortValues } from '#/components/submissions/tableConstants'
import tableStore from '#/components/submissions/tableStore'
import { getRouteAssetUid } from '#/router/routerUtils'

jest.mock('#/router/routerUtils', () => ({
  ...jest.requireActual('#/router/routerUtils'),
  getRouteAssetUid: jest.fn(),
}))

const mockGetRouteAssetUid = getRouteAssetUid as jest.Mock

let testCounter = 0

describe('tableStore', () => {
  let storageKey: string

  beforeEach(() => {
    localStorage.clear()
    mockGetRouteAssetUid.mockReturnValue('assetA')
    // A fresh key per test, as `tableStore` is a singleton.
    testCounter++
    storageKey = `test-key-${testCounter}`
    tableStore.setStorageKey(storageKey)
  })

  it('should persist settings in localStorage, per asset', () => {
    tableStore.setSortBy('Name', SortValues.ASCENDING)
    mockGetRouteAssetUid.mockReturnValue('assetB')
    tableStore.setFrozenColumn('Age', true)

    chai.expect(JSON.parse(localStorage.getItem(storageKey) || '')).to.deep.equal({
      assetA: { [DATA_TABLE_SETTINGS.SORT_BY]: { fieldId: 'Name', value: SortValues.ASCENDING } },
      assetB: { [DATA_TABLE_SETTINGS.FROZEN_COLUMN]: 'Age' },
    })
    chai.expect(tableStore.getSortBy()).to.equal(null)
  })

  it('should drop settings set to `null`', () => {
    tableStore.setFrozenColumn('Age', true)
    tableStore.setFrozenColumn('Age', false)

    chai.expect(JSON.parse(localStorage.getItem(storageKey) || '')).to.deep.equal({ assetA: {} })
    chai.expect(tableStore.getFrozenColumn()).to.equal(null)
  })

  it('should load settings stored under given key', () => {
    const otherKey = `${storageKey}-other`
    localStorage.setItem(otherKey, JSON.stringify({ assetA: { [DATA_TABLE_SETTINGS.SHOW_HXL]: true } }))

    tableStore.setStorageKey(otherKey)

    chai.expect(tableStore.getShowHXLTags()).to.equal(true)
  })

  it('should start with defaults if stored data is malformed', () => {
    const otherKey = `${storageKey}-other`
    localStorage.setItem(otherKey, 'not json{')

    tableStore.setStorageKey(otherKey)

    chai.expect(tableStore.getTableSettings()).to.deep.equal({})
    chai.expect(tableStore.getShowGroupName()).to.equal(true)
  })

  it('should not save anything outside of an asset route', () => {
    mockGetRouteAssetUid.mockReturnValue(null)
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    tableStore.setSortBy('Name', SortValues.ASCENDING)

    chai.expect(localStorage.getItem(storageKey)).to.equal(null)
    consoleErrorSpy.mockRestore()
  })
})
