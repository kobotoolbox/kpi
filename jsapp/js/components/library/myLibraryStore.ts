import type { RouterState } from '@remix-run/router'
import debounce from 'lodash.debounce'
import { reaction } from 'mobx'
import Reflux from 'reflux'
import { actions } from '#/actions'
import assetUtils from '#/assetUtils'
import { ASSETS_TABLE_COLUMNS, ORDER_DIRECTIONS } from '#/components/assetsTable/assetsTableConstants'
import searchBoxStore from '#/components/header/searchBoxStore'
import type { AssetTypeName } from '#/constants'
import type { AssetResponse, AssetsResponse, MetadataResponse, SearchAssetsPredefinedParams } from '#/dataInterface'
import type { OrderDirection } from '#/projects/projectViews/constants'
import { router } from '#/router/legacy'
import { ROUTES } from '#/router/routerConstants'
import { getCurrentPath, isAnyLibraryRoute } from '#/router/routerUtils'

export interface MyLibraryStoreData {
  isFetchingData: boolean
  currentPage: number
  totalPages: number | null
  totalUserAssets: number | null
  totalSearchAssets: number | null
  assets: AssetResponse[]
  metadata: MetadataResponse
  orderColumnId: string
  orderValue: OrderDirection | null | undefined
  filterColumnId: string | null
  filterValue: string | null
}

/**
 * @deprecated migrate to react-query whenever you need to adjust things beyond simple rename
 */
class MyLibraryStore extends Reflux.Store {
  /**
   * A method for aborting current XHR fetch request.
   * It doesn't need to be defined upfront, but I'm adding it here for clarity.
   */
  abortFetchData?: Function
  previousPath = getCurrentPath()
  PAGE_SIZE = 100
  DEFAULT_ORDER_COLUMN = ASSETS_TABLE_COLUMNS['date-modified']
  searchContext = 'MY_LIBRARY'

  isInitialised = false

  data: MyLibraryStoreData = {
    isFetchingData: false,
    currentPage: 0,
    totalPages: null,
    totalUserAssets: null,
    totalSearchAssets: null,
    assets: [],
    metadata: {
      languages: [],
      countries: [],
      sectors: [],
      organizations: [],
    },
    orderColumnId: this.DEFAULT_ORDER_COLUMN.id,
    orderValue: this.DEFAULT_ORDER_COLUMN.defaultValue,
    filterColumnId: null,
    filterValue: null,
  }

  fetchDataDebounced?: (needsMetadata?: boolean) => void

  init() {
    this.fetchDataDebounced = debounce(this.fetchData.bind(this), 2500)

    this.setDefaultColumns()

    // HACK: We add this ugly `setTimeout` to ensure router exists.
    setTimeout(() => router!.subscribe(this.onRouteChange.bind(this)))

    reaction(
      () => [searchBoxStore.data.context, searchBoxStore.data.searchPhrase],
      this.onSearchBoxStoreChanged.bind(this),
    )

    actions.library.moveToCollection.completed.listen(this.onMoveToCollectionCompleted.bind(this))
    actions.library.subscribeToCollection.completed.listen(this.fetchData.bind(this, true))
    actions.library.unsubscribeFromCollection.completed.listen(this.fetchData.bind(this, true))
    actions.library.searchMyLibraryAssets.started.listen(this.onSearchStarted.bind(this))
    actions.library.searchMyLibraryAssets.completed.listen(this.onSearchCompleted.bind(this))
    actions.library.searchMyLibraryAssets.failed.listen(this.onSearchFailed.bind(this))
    actions.library.searchMyLibraryMetadata.completed.listen(this.onSearchMetadataCompleted.bind(this))
    actions.resources.loadAsset.completed.listen(this.onAssetChanged.bind(this))
    actions.resources.updateAsset.completed.listen(this.onAssetChanged.bind(this))
    actions.resources.cloneAsset.completed.listen(this.onAssetCreated.bind(this))
    actions.resources.createResource.completed.listen(this.onAssetCreated.bind(this))
    actions.resources.deleteAsset.completed.listen(this.onDeleteAssetCompleted.bind(this))
    // TODO Improve reaction to uploads being finished after task is done:
    // https://github.com/kobotoolbox/kpi/issues/476
    actions.resources.createImport.completed.listen(this.fetchDataDebounced.bind(this, true))

    // startup store after config is ready
    actions.permissions.getConfig.completed.listen(this.startupStore.bind(this))
  }

  /**
   * Only makes a call to BE when loaded app on a library route
   * otherwise wait until route changes to a library (see `onRouteChange`)
   */
  startupStore() {
    if (!this.isInitialised && isAnyLibraryRoute() && !this.data.isFetchingData) {
      // This will indirectly run `fetchData`
      searchBoxStore.setContext(this.searchContext)
    }
  }

  /** Changes the order column to default and remove filtering. */
  setDefaultColumns() {
    this.data.orderColumnId = this.DEFAULT_ORDER_COLUMN.id
    this.data.orderValue = this.DEFAULT_ORDER_COLUMN.defaultValue
    this.data.filterColumnId = null
    this.data.filterValue = null
  }

  // methods for handling search and data fetch

  getSearchParams() {
    const params: SearchAssetsPredefinedParams = {
      searchPhrase: (searchBoxStore.data.searchPhrase ?? '').trim(),
      pageSize: this.PAGE_SIZE,
      page: this.data.currentPage,
      collectionsFirst: true,
    }

    if (this.data.filterColumnId !== null) {
      const filterColumn = ASSETS_TABLE_COLUMNS[this.data.filterColumnId]
      params.filterProperty = filterColumn.filterBy
      params.filterValue = this.data.filterValue || undefined
    }

    // Surrounds `filterValue` with double quotes to avoid filters that have
    // spaces which would split the query in two, thus breaking the filter
    if (params.filterValue !== undefined) {
      params.filterValue = JSON.stringify(params.filterValue) // Adds quotes
    }

    return params
  }

  fetchMetadata() {
    actions.library.searchMyLibraryMetadata(this.getSearchParams())
  }

  fetchData(needsMetadata = false) {
    if (this.abortFetchData !== undefined) {
      this.abortFetchData()
    }

    const params = this.getSearchParams()

    params.metadata = needsMetadata

    const orderColumn = ASSETS_TABLE_COLUMNS[this.data.orderColumnId]
    const direction = this.data.orderValue === ORDER_DIRECTIONS.ascending ? '' : '-'
    params.ordering = `${direction}${orderColumn.orderBy}`

    actions.library.searchMyLibraryAssets(params)
  }

  onRouteChange(data: RouterState) {
    if (!this.isInitialised && isAnyLibraryRoute() && !this.data.isFetchingData) {
      // This will indirectly run `fetchData`
      searchBoxStore.setContext(this.searchContext)
    } else if (
      // coming from outside of library
      (this.previousPath.split('/')[1] !== 'library' ||
        // public-collections is a special case that is kinda in library, but
        // actually outside of it
        this.previousPath.startsWith(ROUTES.PUBLIC_COLLECTIONS)) &&
      // coming into library
      isAnyLibraryRoute()
    ) {
      // refresh data when navigating into library from other place
      this.setDefaultColumns()
      // This will indirectly run `fetchData`
      searchBoxStore.setContext(this.searchContext)
    }
    this.previousPath = data.location.pathname
  }

  onSearchBoxStoreChanged() {
    if (searchBoxStore.data.context === this.searchContext) {
      // reset to first page when search changes
      this.data.currentPage = 0
      this.data.totalPages = null
      this.data.totalSearchAssets = null
      this.fetchData(true)
    }
  }

  onSearchStarted(abort: Function) {
    this.abortFetchData = abort
    this.data.isFetchingData = true
    this.trigger(this.data)
  }

  onSearchCompleted(response: AssetsResponse) {
    delete this.abortFetchData
    this.data.totalPages = Math.ceil(response.count / this.PAGE_SIZE)
    this.data.assets = response.results
    // if we didn't fetch metadata, we assume it didn't change so leave current one
    if (response.metadata) {
      this.data.metadata = response.metadata
    }
    this.data.totalSearchAssets = response.count
    // update total count for the first time and the ones that will get a full count
    if (this.data.totalUserAssets === null || searchBoxStore.data.searchPhrase === '') {
      this.data.totalUserAssets = this.data.totalSearchAssets
    }
    this.data.isFetchingData = false
    this.isInitialised = true
    this.trigger(this.data)
  }

  onSearchFailed() {
    delete this.abortFetchData
    this.data.isFetchingData = false
    this.trigger(this.data)
  }

  onSearchMetadataCompleted(response: MetadataResponse) {
    this.data.metadata = response
    this.trigger(this.data)
  }

  // methods for handling actions that update assets

  onMoveToCollectionCompleted(asset: AssetResponse) {
    if (assetUtils.isLibraryAsset(asset.asset_type)) {
      // update total root assets after moving asset into/out of collection
      if (this.data.totalUserAssets !== null && asset.parent === null) {
        this.data.totalUserAssets++
      } else if (this.data.totalUserAssets !== null) {
        this.data.totalUserAssets--
      }
      this.fetchData(true)
    }
  }

  onAssetChanged(asset: AssetResponse) {
    if (assetUtils.isLibraryAsset(asset.asset_type) && this.data.assets.length !== 0) {
      let wasUpdated = false
      for (let i = 0; i < this.data.assets.length; i++) {
        const loopAsset = this.data.assets[i]
        if (
          loopAsset.uid === asset.uid &&
          // if the changed asset didn't change (e.g. was just loaded)
          // let's not cause it to fetchMetadata
          (loopAsset.date_modified !== asset.date_modified || loopAsset.version_id !== asset.version_id)
        ) {
          this.data.assets[i] = asset
          wasUpdated = true
          break
        }
      }
      if (wasUpdated) {
        this.trigger(this.data)
        this.fetchMetadata()
      }
    }
  }

  onAssetCreated(asset: AssetResponse) {
    if (assetUtils.isLibraryAsset(asset.asset_type) && asset.parent === null) {
      if (this.data.totalUserAssets !== null) {
        this.data.totalUserAssets++
      }
      this.fetchData(true)
    }
  }

  onDeleteAssetCompleted(response: { uid: string; assetType: AssetTypeName }) {
    if (assetUtils.isLibraryAsset(response.assetType)) {
      const found = this.findAsset(response.uid)
      if (found) {
        if (this.data.totalUserAssets !== null) {
          this.data.totalUserAssets--
        }
        this.fetchData(true)
      }
      // if not found it is possible it is on other page of results, but it is
      // not important enough to do a data fetch
    }
  }

  // public methods

  setCurrentPage(newCurrentPage: number) {
    this.data.currentPage = newCurrentPage
    this.fetchData()
  }

  setOrder(orderColumnId: string, orderValue: OrderDirection) {
    if (this.data.orderColumnId !== orderColumnId || this.data.orderValue !== orderValue) {
      this.data.orderColumnId = orderColumnId
      this.data.orderValue = orderValue
      this.fetchData()
    }
  }

  /** Pass `null`s to clear filter column */
  setFilter(filterColumnId: string | null, filterValue: string | null) {
    if (this.data.filterColumnId !== filterColumnId || this.data.filterValue !== filterValue) {
      this.data.filterColumnId = filterColumnId
      this.data.filterValue = filterValue
      // When a filter is selected, the pages reflects the total number of
      // filtered assets, so we have to reset page number to display them
      // properly, otherwise we can be out of bounds.
      this.data.currentPage = 0
      this.fetchData(true)
    }
  }

  resetOrderAndFilter() {
    this.setDefaultColumns()
    this.fetchData(true)
  }

  hasAllDefaultValues() {
    return (
      this.data.orderColumnId === this.DEFAULT_ORDER_COLUMN.id &&
      this.data.orderValue === this.DEFAULT_ORDER_COLUMN.defaultValue &&
      this.data.filterColumnId === null &&
      this.data.filterValue === null
    )
  }

  getCurrentUserTotalAssets() {
    return this.data.totalUserAssets
  }

  findAsset(uid: string) {
    return this.data.assets.find((asset) => asset.uid === uid)
  }

  findAssetByUrl(url: string) {
    return this.data.assets.find((asset) => asset.url === url)
  }
}

/**
 * @deprecated migrate to react-query whenever you need to adjust things beyond simple rename
 */
const myLibraryStore = new MyLibraryStore()
myLibraryStore.init()

export default myLibraryStore
