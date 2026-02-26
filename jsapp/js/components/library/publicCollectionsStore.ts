import type { RouterState } from '@remix-run/router'
import { reaction } from 'mobx'
import Reflux from 'reflux'
import { actions } from '#/actions'
import assetUtils from '#/assetUtils'
import { ASSETS_TABLE_COLUMNS, ORDER_DIRECTIONS } from '#/components/assetsTable/assetsTableConstants'
import type { AssetsTableColumn } from '#/components/assetsTable/assetsTableConstants'
import searchBoxStore from '#/components/header/searchBoxStore'
import { ACCESS_TYPES, ASSET_TYPES } from '#/constants'
import type {
  AssetResponse,
  AssetSubscriptionsResponse,
  AssetsResponse,
  DeleteAssetResponse,
  MetadataResponse,
  SearchAssetsPredefinedParams,
} from '#/dataInterface'
import type { OrderDirection } from '#/projects/projectViews/constants'
import { router } from '#/router/legacy'
import { ROUTES } from '#/router/routerConstants'
import { getCurrentPath, isPublicCollectionsRoute } from '#/router/routerUtils'

export interface PublicCollectionsStoreData {
  isFetchingData: boolean
  currentPage: number
  totalPages: number | null
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
class PublicCollectionsStore extends Reflux.Store {
  /**
   * A method for aborting current XHR fetch request.
   * It doesn't need to be defined upfront, but I'm adding it here for clarity.
   */
  abortFetchData?: Function
  previousPath = getCurrentPath()
  PAGE_SIZE = 100
  DEFAULT_ORDER_COLUMN = ASSETS_TABLE_COLUMNS['date-modified']
  searchContext = 'PUBLIC_COLLECTIONS'

  isInitialised = false

  data: PublicCollectionsStoreData = {
    isFetchingData: false,
    currentPage: 0,
    totalPages: null,
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

  init() {
    this.setDefaultColumns()

    // HACK: We add this ugly `setTimeout` to ensure router exists.
    setTimeout(() => router!.subscribe(this.onRouteChange.bind(this)))

    reaction(
      () => [searchBoxStore.data.context, searchBoxStore.data.searchPhrase],
      this.onSearchBoxStoreChanged.bind(this),
    )

    actions.library.searchPublicCollections.started.listen(this.onSearchStarted.bind(this))
    actions.library.searchPublicCollections.completed.listen(this.onSearchCompleted.bind(this))
    actions.library.searchPublicCollections.failed.listen(this.onSearchFailed.bind(this))
    actions.library.searchPublicCollectionsMetadata.completed.listen(this.onSearchMetadataCompleted.bind(this))
    actions.library.subscribeToCollection.completed.listen(this.onSubscribeCompleted.bind(this))
    actions.library.unsubscribeFromCollection.listen(this.onUnsubscribeCompleted.bind(this))
    actions.library.moveToCollection.completed.listen(this.onMoveToCollectionCompleted.bind(this))
    actions.resources.loadAsset.completed.listen(this.onAssetChanged.bind(this))
    actions.resources.updateAsset.completed.listen(this.onAssetChanged.bind(this))
    actions.resources.cloneAsset.completed.listen(this.onAssetCreated.bind(this))
    actions.resources.createResource.completed.listen(this.onAssetCreated.bind(this))
    actions.resources.deleteAsset.completed.listen(this.onDeleteAssetCompleted.bind(this))

    // startup store after config is ready
    actions.permissions.getConfig.completed.listen(this.startupStore.bind(this))
  }

  /**
   * Only makes a call to BE when loaded app on a library route
   * otherwise wait until route changes to a library (see `onRouteChange`)
   */
  startupStore() {
    if (!this.isInitialised && isPublicCollectionsRoute() && !this.data.isFetchingData) {
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
    }

    if (this.data.filterColumnId) {
      const filterColumn = ASSETS_TABLE_COLUMNS[this.data.filterColumnId]
      params.filterProperty = filterColumn.filterBy
      params.filterValue = this.data.filterValue ? this.data.filterValue : undefined
    }

    // Surrounds `filterValue` with double quotes to avoid filters that have
    // spaces which would split the query in two, thus breaking the filter
    if (params.filterValue !== undefined) {
      params.filterValue = JSON.stringify(params.filterValue) // Adds quotes
    }

    return params
  }

  fetchMetadata() {
    actions.library.searchPublicCollectionsMetadata(this.getSearchParams())
  }

  fetchData(needsMetadata = false) {
    if (this.abortFetchData) {
      this.abortFetchData()
    }

    const params = this.getSearchParams()

    params.metadata = needsMetadata

    let orderColumn: AssetsTableColumn
    if (this.data.orderColumnId) {
      orderColumn = ASSETS_TABLE_COLUMNS[this.data.orderColumnId]
      const direction = this.data.orderValue === ORDER_DIRECTIONS.ascending ? '' : '-'
      params.ordering = `${direction}${orderColumn.orderBy}`
    }

    actions.library.searchPublicCollections(params)
  }

  onRouteChange(data: RouterState) {
    if (!this.isInitialised && isPublicCollectionsRoute() && !this.data.isFetchingData) {
      // This will indirectly run `fetchData`
      searchBoxStore.setContext(this.searchContext)
    } else if (this.previousPath.startsWith(ROUTES.PUBLIC_COLLECTIONS) === false && isPublicCollectionsRoute()) {
      // refresh data when navigating into public-collections from other place
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

  onSearchStarted(abort: () => void) {
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

  onSubscribeCompleted(subscriptionData: AssetSubscriptionsResponse) {
    this.onAssetAccessTypeChanged(subscriptionData.asset, true)
  }

  onUnsubscribeCompleted(assetUid: string) {
    this.onAssetAccessTypeChanged(assetUid, false)
  }

  onAssetAccessTypeChanged(assetUidOrUrl: string, setSubscribed: boolean) {
    let wasUpdated = false
    for (let i = 0; i < this.data.assets.length; i++) {
      const assetObj = this.data.assets[i]
      if (assetObj.uid === assetUidOrUrl || assetObj.url === assetUidOrUrl) {
        if (setSubscribed) {
          assetObj.access_types?.push(ACCESS_TYPES.subscribed)
        } else {
          assetObj.access_types?.splice(assetObj.access_types?.indexOf(ACCESS_TYPES.subscribed), 1)
        }
        wasUpdated = true
        break
      }
    }
    if (wasUpdated) {
      this.trigger(this.data)
    }
  }

  onMoveToCollectionCompleted(asset: AssetResponse) {
    if (asset.asset_type === ASSET_TYPES.collection.id && assetUtils.isAssetPublic(asset.permissions)) {
      this.fetchData(true)
    }
  }

  onAssetChanged(asset: AssetResponse) {
    if (
      asset.asset_type === ASSET_TYPES.collection.id &&
      assetUtils.isAssetPublic(asset.permissions) &&
      this.data.assets.length !== 0
    ) {
      let wasUpdated = false
      for (let i = 0; i < this.data.assets.length; i++) {
        if (this.data.assets[i].uid === asset.uid) {
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
    if (asset.asset_type === ASSET_TYPES.collection.id && assetUtils.isAssetPublic(asset.permissions)) {
      this.fetchData(true)
    }
  }

  onDeleteAssetCompleted({ uid, assetType }: DeleteAssetResponse) {
    if (assetType === ASSET_TYPES.collection.id) {
      const found = this.findAsset(uid)
      if (found) {
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

  /**
   * `filterColumnId` - pass null to clear filter column
   * `filterValue` - pass null to clear filter column
   */
  setFilter(filterColumnId: string | null, filterValue: string | null) {
    if (this.data.filterColumnId !== filterColumnId || this.data.filterValue !== filterValue) {
      this.data.filterColumnId = filterColumnId
      this.data.filterValue = filterValue
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

  findAsset(uid: string) {
    return this.data.assets.find((asset) => asset.uid === uid)
  }
}

/**
 * @deprecated migrate to react-query whenever you need to adjust things beyond simple rename
 */
const publicCollectionsStore = new PublicCollectionsStore()
publicCollectionsStore.init()

export default publicCollectionsStore
