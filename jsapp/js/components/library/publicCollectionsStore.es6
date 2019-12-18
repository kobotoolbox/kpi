import Reflux from 'reflux';
import searchBoxStore from '../header/searchBoxStore';
import {actions} from 'js/actions';
import {ASSETS_TABLE_COLUMNS} from './assetsTable';

const publicCollectionsStore = Reflux.createStore({
  /**
   * A method for aborting current XHR fetch request.
   * It doesn't need to be defined, but I'm adding it here for clarity.
   */
  abortFetchData: undefined,

  // TODO make it 100 after development
  PAGE_SIZE: 3,

  DEFAULT_COLUMN: ASSETS_TABLE_COLUMNS.get('last-modified'),

  init() {
    this.data = {
      isFetchingData: false,
      sortColumn: this.DEFAULT_COLUMN,
      isOrderAsc: this.DEFAULT_COLUMN.defaultIsOrderAsc,
      currentPage: 0,
      totalPages: null,
      totalUserAssets: null,
      totalSearchAssets: null,
      assets: []
    };

    // TODO update this list whenever existing item is changed

    // TODO reset data properly on some actions or when leaving route out of library

    this.listenTo(searchBoxStore, this.searchBoxStoreChanged);
    this.listenTo(actions.library.searchPublicCollections.started, this.onSearchStarted);
    this.listenTo(actions.library.searchPublicCollections.completed, this.onSearchCompleted);
    this.listenTo(actions.library.searchPublicCollections.failed, this.onSearchFailed);

    this.fetchData();
  },

  // methods for handling search parameters

  searchBoxStoreChanged() {
    // reset to first page when search changes
    this.data.currentPage = 0;
    this.data.totalPages = null;
    this.data.totalSearchAssets = null;
    this.fetchData();
  },

  // methods for handling actions

  onSearchStarted(abort) {
    this.abortFetchData = abort;
    this.data.isFetchingData = true;
    this.trigger(this.data);
  },

  onSearchCompleted(response) {
    console.debug('onSearchCompleted', response);

    delete this.abortFetchData;

    this.data.hasNextPage = response.next !== null;
    this.data.hasPreviousPage = response.previous !== null;

    this.data.totalPages = Math.ceil(response.count / this.PAGE_SIZE);

    this.data.assets = response.results;
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

  // public methods

  setCurrentPage(newCurrentPage) {
    this.data.currentPage = newCurrentPage;
    this.fetchData();
  },

  setOrder(sortColumn, isOrderAsc) {
    if (
      this.data.sortColumn.id !== sortColumn.id ||
      this.data.isOrderAsc !== isOrderAsc
    ) {
      this.data.sortColumn = sortColumn;
      this.data.isOrderAsc = isOrderAsc;
      this.fetchData();
    }
  },

  // the method for fetching new data

  fetchData() {
    if (this.abortFetchData) {
      this.abortFetchData();
    }

    actions.library.searchPublicCollections({
      searchPhrase: searchBoxStore.getSearchPhrase(),
      pageSize: this.PAGE_SIZE,
      page: this.data.currentPage,
      sort: this.data.sortColumn.backendProp,
      order: this.data.isOrderAsc ? -1 : 1
    });
  },
});

export default publicCollectionsStore;
