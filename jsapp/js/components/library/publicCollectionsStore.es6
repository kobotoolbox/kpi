import Reflux from 'reflux';
import {hashHistory} from 'react-router';
import searchBoxStore from '../header/searchBoxStore';
import assetUtils from 'js/assetUtils';
import {actions} from 'js/actions';
import {
  ORDER_DIRECTIONS,
  ASSETS_TABLE_COLUMNS
} from './assetsTable';
import {
  ASSET_TYPES,
  ACCESS_TYPES
} from 'js/constants';

const publicCollectionsStore = Reflux.createStore({
  /**
   * A method for aborting current XHR fetch request.
   * It doesn't need to be defined upfront, but I'm adding it here for clarity.
   */
  abortFetchData: undefined,
  previousPath: null,
  PAGE_SIZE: 100,
  DEFAULT_ORDER_COLUMN: ASSETS_TABLE_COLUMNS.get('date-modified'),

  init() {
    this.data = {
      isFetchingData: false,
      orderColumnId: this.DEFAULT_ORDER_COLUMN.id,
      orderValue: this.DEFAULT_ORDER_COLUMN.defaultValue,
      filterColumnId: null,
      filterValue: null,
      currentPage: 0,
      totalPages: null,
      totalUserAssets: null,
      totalSearchAssets: null,
      assets: [],
      metadata: {}
    };

    hashHistory.listen(this.onRouteChange.bind(this));
    searchBoxStore.listen(this.searchBoxStoreChanged);
    actions.library.searchPublicCollections.started.listen(this.onSearchStarted);
    actions.library.searchPublicCollections.completed.listen(this.onSearchCompleted);
    actions.library.searchPublicCollections.failed.listen(this.onSearchFailed);
    actions.library.subscribeToCollection.completed.listen(this.onSubscribeCompleted);
    actions.library.unsubscribeFromCollection.listen(this.onUnsubscribeCompleted);
    actions.library.moveToCollection.completed.listen(this.onMoveToCollectionCompleted);
    actions.resources.loadAsset.completed.listen(this.onAssetChanged);
    actions.resources.updateAsset.completed.listen(this.onAssetChanged);
    actions.resources.cloneAsset.completed.listen(this.onAssetCreated);
    actions.resources.createResource.completed.listen(this.onAssetCreated);
    actions.resources.deleteAsset.completed.listen(this.onDeleteAssetCompleted);

    this.fetchData();
  },

  // methods for handling search and data fetch

  fetchData() {
    if (this.abortFetchData) {
      this.abortFetchData();
    }

    const params = {
      searchPhrase: searchBoxStore.getSearchPhrase(),
      pageSize: this.PAGE_SIZE,
      page: this.data.currentPage,
    };

    const orderColumn = ASSETS_TABLE_COLUMNS.get(this.data.orderColumnId);
    const direction = this.data.orderValue === ORDER_DIRECTIONS.get('ascending') ? '' : '-';
    params.ordering = `${direction}${orderColumn.orderBy}`;

    if (this.data.filterColumnId !== null) {
      const filterColumn = ASSETS_TABLE_COLUMNS.get(this.data.filterColumnId);
      params.filterProperty = filterColumn.filterBy;
      params.filterValue = this.data.filterValue;
    }

    actions.library.searchPublicCollections(params);
  },

  onRouteChange(data) {
    // refresh data when navigating into library from other place
    if (
      this.previousPath !== null &&
      this.previousPath.split('/')[1] !== 'library' &&
      data.pathname.split('/')[1] === 'library'
    ) {
      this.fetchData();
    }
    this.previousPath = data.pathname;
  },

  searchBoxStoreChanged() {
    // reset to first page when search changes
    this.data.currentPage = 0;
    this.data.totalPages = null;
    this.data.totalSearchAssets = null;
    this.fetchData();
  },

  onSearchStarted(abort) {
    this.abortFetchData = abort;
    this.data.isFetchingData = true;
    this.trigger(this.data);
  },

  onSearchCompleted(response) {
    delete this.abortFetchData;

    this.data.hasNextPage = response.next !== null;
    this.data.hasPreviousPage = response.previous !== null;

    this.data.totalPages = Math.ceil(response.count / this.PAGE_SIZE);

    this.data.assets = response.results;
    this.data.metadata = response.metadata;
    this.data.totalSearchAssets = response.count;
    if (this.data.totalUserAssets === null) {
      this.data.totalUserAssets = this.data.totalSearchAssets;
    }
    this.data.isFetchingData = false;
    this.trigger(this.data);
  },

  onSearchFailed() {
    delete this.abortFetchData;
    this.data.isFetchingData = false;
    this.trigger(this.data);
  },

  // methods for handling actions that update assets

  onSubscribeCompleted(subscriptionData) {
    this.onAssetAccessTypeChanged(subscriptionData.asset, ACCESS_TYPES.get('subscribed'));
  },

  onUnsubscribeCompleted(assetUid) {
    this.onAssetAccessTypeChanged(assetUid, ACCESS_TYPES.get('public'));
  },

  onAssetAccessTypeChanged(assetUidOrUrl, accessType) {
    let wasUpdated = false;
    for (let i = 0; i < this.data.assets.length; i++) {
      if (
        this.data.assets[i].uid === assetUidOrUrl ||
        this.data.assets[i].url === assetUidOrUrl
      ) {
        this.data.assets[i].access_type = accessType;
        wasUpdated = true;
        break;
      }
    }
    if (wasUpdated) {
      this.trigger(this.data);
    }
  },

  onMoveToCollectionCompleted(asset) {
    if (
      asset.asset_type === ASSET_TYPES.collection.id &&
      assetUtils.isAssetPublic(asset.permissions)
    ) {
      this.fetchData();
    }
  },

  onAssetChanged(asset) {
    if (
      asset.asset_type === ASSET_TYPES.collection.id &&
      assetUtils.isAssetPublic(asset.permissions) &&
      this.data.assets.length !== 0
    ) {
      let wasUpdated = false;
      for (let i = 0; i < this.data.assets.length; i++) {
        if (this.data.assets[i].uid === asset.uid) {
          this.data.assets[i] = asset;
          wasUpdated = true;
          break;
        }
      }
      if (wasUpdated) {
        this.trigger(this.data);
      }
    }
  },

  onAssetCreated(asset) {
    if (
      asset.asset_type === ASSET_TYPES.collection.id &&
      assetUtils.isAssetPublic(asset.permissions)
    ) {
      this.fetchData();
    }
  },

  onDeleteAssetCompleted({uid, assetType}) {
    if (assetType === ASSET_TYPES.collection.id) {
      const found = this.data.assets.find((asset) => {return asset.uid === uid;});
      if (found) {
        this.fetchData();
      }
      // if not found it is possible it is on other page of results, but it is
      // not important enough to do a data fetch
    }
  },

  // public methods

  setCurrentPage(newCurrentPage) {
    this.data.currentPage = newCurrentPage;
    this.fetchData();
  },

  /**
   * @param {string} orderColumnId
   * @param {string} orderValue
   */
  setOrder(orderColumnId, orderValue) {
    if (
      this.data.orderColumnId !== orderColumnId ||
      this.data.orderValue !== orderValue
    ) {
      this.data.orderColumnId = orderColumnId;
      this.data.orderValue = orderValue;
      this.fetchData();
    }
  },

  /**
   * @param {string|null} filterColumnId - pass null to clear filter column
   * @param {string} filterValue - pass null to clear filter column
   */
  setFilter(filterColumnId, filterValue) {
    if (
      this.data.filterColumnId !== filterColumnId ||
      this.data.filterValue !== filterValue
    ) {
      this.data.filterColumnId = filterColumnId;
      this.data.filterValue = filterValue;
      this.fetchData();
    }
  }
});

export default publicCollectionsStore;
