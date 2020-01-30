import Reflux from 'reflux';
import {hashHistory} from 'react-router';
import searchBoxStore from '../header/searchBoxStore';
import assetUtils from 'js/assetUtils';
import {actions} from 'js/actions';
import {
  ORDER_DIRECTIONS,
  ASSETS_TABLE_COLUMNS
} from './assetsTable';

const myLibraryStore = Reflux.createStore({
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
      currentPage: 0,
      totalPages: null,
      totalUserAssets: null,
      totalSearchAssets: null,
      assets: [],
      metadata: {}
    };
    this.setDefaultColumns();

    // TODO react to uploads being finished (debounced reaction because of
    // possible multiple uploads) or don't react at all?

    hashHistory.listen(this.onRouteChange.bind(this));
    searchBoxStore.listen(this.searchBoxStoreChanged);
    actions.library.moveToCollection.completed.listen(this.onMoveToCollectionCompleted);
    actions.library.subscribeToCollection.completed.listen(this.fetchData.bind(this, true));
    actions.library.unsubscribeFromCollection.completed.listen(this.fetchData.bind(this, true));
    actions.library.searchMyLibraryAssets.started.listen(this.onSearchStarted);
    actions.library.searchMyLibraryAssets.completed.listen(this.onSearchCompleted);
    actions.library.searchMyLibraryAssets.failed.listen(this.onSearchFailed);
    actions.resources.loadAsset.completed.listen(this.onAssetChanged);
    actions.resources.updateAsset.completed.listen(this.onAssetChanged);
    actions.resources.cloneAsset.completed.listen(this.onAssetCreated);
    actions.resources.createResource.completed.listen(this.onAssetCreated);
    actions.resources.deleteAsset.completed.listen(this.onDeleteAssetCompleted);

    this.fetchData(true);
  },

  setDefaultColumns() {
    this.data.orderColumnId = this.DEFAULT_ORDER_COLUMN.id;
    this.data.orderValue = this.DEFAULT_ORDER_COLUMN.defaultValue;
    this.data.filterColumnId = null;
    this.data.filterValue = null;
  },

  // methods for handling search and data fetch

  fetchMetadata() {
    // TODO call metadata fatch when endpoint is ready
  },

  /**
   * @param {boolean} needsMetadata
   */
  fetchData(needsMetadata = false) {
    if (this.abortFetchData) {
      this.abortFetchData();
    }

    const params = {
      searchPhrase: searchBoxStore.getSearchPhrase(),
      pageSize: this.PAGE_SIZE,
      page: this.data.currentPage,
      metadata: needsMetadata
    };

    const orderColumn = ASSETS_TABLE_COLUMNS.get(this.data.orderColumnId);
    const direction = this.data.orderValue === ORDER_DIRECTIONS.get('ascending') ? '' : '-';
    params.ordering = `${direction}${orderColumn.orderBy}`;

    if (this.data.filterColumnId !== null) {
      const filterColumn = ASSETS_TABLE_COLUMNS.get(this.data.filterColumnId);
      params.filterProperty = filterColumn.filterBy;
      params.filterValue = this.data.filterValue;
    }

    actions.library.searchMyLibraryAssets(params);
  },

  onRouteChange(data) {
    // refresh data when navigating into library from other place
    if (
      this.previousPath !== null &&
      this.previousPath.split('/')[1] !== 'library' &&
      data.pathname.split('/')[1] === 'library'
    ) {
      this.setDefaultColumns();
      this.fetchData(true);
    }
    this.previousPath = data.pathname;
  },

  searchBoxStoreChanged() {
    // reset to first page when search changes
    this.data.currentPage = 0;
    this.data.totalPages = null;
    this.data.totalSearchAssets = null;
    this.fetchData(true);
  },

  onSearchStarted(abort) {
    this.abortFetchData = abort;
    this.data.isFetchingData = true;
    this.trigger(this.data);
  },

  onSearchCompleted(response) {
    delete this.abortFetchData;

    this.data.totalPages = Math.ceil(response.count / this.PAGE_SIZE);

    this.data.assets = response.results;
    if (response.metadata) {
      // if we didn't fetch metadata, we assume it didn't change so leave current one
      this.data.metadata = response.metadata;
    }
    this.data.totalSearchAssets = response.count;

    // update total count for the first time and the ones that will get a full count
    if (
      this.data.totalUserAssets === null ||
      searchBoxStore.getSearchPhrase() === ''
    ) {
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

  onMoveToCollectionCompleted(asset) {
    if (assetUtils.isLibraryAsset(asset.asset_type)) {
      // update total root assets after moving asset into/out of collection
      if (asset.parent === null) {
        this.data.totalUserAssets++;
      } else {
        this.data.totalUserAssets--;
      }
      this.fetchData(true);
    }
  },

  onAssetChanged(asset) {
    if (
      assetUtils.isLibraryAsset(asset.asset_type) &&
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
        this.fetchMetadata();
      }
    }
  },

  onAssetCreated(asset) {
    if (
      assetUtils.isLibraryAsset(asset.asset_type) &&
      asset.parent === null
    ) {
      this.data.totalUserAssets++;
      this.fetchData(true);
    }
  },

  onDeleteAssetCompleted({uid, assetType}) {
    if (assetUtils.isLibraryAsset(assetType)) {
      const found = this.data.assets.find((asset) => {return asset.uid === uid;});
      if (found) {
        this.data.totalUserAssets--;
        this.fetchData(true);
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
      this.fetchData(true);
    }
  },

  resetOrderAndFilter() {
    this.setDefaultColumns();
    this.fetchData(true);
  },

  hasAllDefaultValues() {
    return (
      this.data.orderColumnId === this.DEFAULT_ORDER_COLUMN.id &&
      this.data.orderValue === this.DEFAULT_ORDER_COLUMN.defaultValue &&
      this.data.filterColumnId === null &&
      this.data.filterValue === null
    );
  }
});

export default myLibraryStore;
