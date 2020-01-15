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
  DEFAULT_COLUMN: ASSETS_TABLE_COLUMNS.get('date-modified'),

  init() {
    this.data = {
      isFetchingData: false,
      column: this.DEFAULT_COLUMN,
      columnValue: this.DEFAULT_COLUMN.defaultValue,
      currentPage: 0,
      totalPages: null,
      totalUserAssets: null,
      totalSearchAssets: null,
      assets: []
    };

    // TODO react to upload(s) finishing (debounced because of multiple uploads)
    // or don't react at all ;-)

    hashHistory.listen(this.onRouteChange.bind(this));
    searchBoxStore.listen(this.searchBoxStoreChanged);
    actions.library.moveToCollection.completed.listen(this.onMoveToCollectionCompleted);
    actions.library.searchMyLibraryAssets.started.listen(this.onSearchStarted);
    actions.library.searchMyLibraryAssets.completed.listen(this.onSearchCompleted);
    actions.library.searchMyLibraryAssets.failed.listen(this.onSearchFailed);
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

    actions.library.searchMyLibraryAssets({
      searchPhrase: searchBoxStore.getSearchPhrase(),
      pageSize: this.PAGE_SIZE,
      page: this.data.currentPage,
      sort: this.data.column.orderBy || this.data.column.filterBy,
      order: this.data.columnValue === ORDER_DIRECTIONS.get('ascending') ? '+' : '-'
    });
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
      this.fetchData();
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
      }
    }
  },

  onDeleteAssetCompleted({uid, assetType}) {
    if (assetUtils.isLibraryAsset(assetType)) {
      const found = this.data.assets.find((asset) => {return asset.uid === uid;});
      if (found) {
        this.data.totalUserAssets--;
        this.fetchData();
      }
      // if not found it is possible it is on other page of results, but it is
      // not important enough to do a data fetch
    }
  },

  onAssetCreated(asset) {
    if (
      assetUtils.isLibraryAsset(asset.asset_type) &&
      asset.parent === null
    ) {
      this.data.totalUserAssets++;
      this.fetchData();
    }
  },

  // public methods

  setCurrentPage(newCurrentPage) {
    this.data.currentPage = newCurrentPage;
    this.fetchData();
  },

  setOrder(column, columnValue) {
    if (
      this.data.column.id !== column.id ||
      this.data.columnValue !== columnValue
    ) {
      this.data.column = column;
      this.data.columnValue = columnValue;
      this.fetchData();
    }
  }
});

export default myLibraryStore;
