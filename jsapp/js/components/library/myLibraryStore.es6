import Reflux from 'reflux';
import searchBoxStore from '../header/searchBoxStore';
import {actions} from 'js/actions';

const myLibraryStore = Reflux.createStore({
  /**
   * A method for aborting current XHR fetch request.
   * It doesn't need to be defined, but I'm adding it here for clarity.
   */
  abortFetchData: undefined,

  PAGE_SIZE: 100,

  init() {
    this.data = {
      isFetchingData: false,
      hasNextPage: false,
      hasPreviousPage: false,
      totalUserAssets: null,
      totalAssets: 0,
      assets: []
    };

    this.listenTo(searchBoxStore, this.searchBoxStoreChanged);
    this.listenTo(actions.library.searchMyLibraryAssets.started, this.onSearchStarted);
    this.listenTo(actions.library.searchMyLibraryAssets.completed, this.onSearchCompleted);
    this.listenTo(actions.library.searchMyLibraryAssets.failed, this.onSearchFailed);

    this.fetchData();
  },

  // methods for handling search parameters

  searchBoxStoreChanged() {
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
    this.data.assets = response.results;
    this.data.totalAssets = response.count;
    if (this.data.totalUserAssets === null) {
      this.data.totalUserAssets = this.data.totalAssets;
    }
    this.data.isFetchingData = false;
    this.trigger(this.data);
  },

  onSearchFailed() {
    delete this.abortFetchData;
    this.data.isFetchingData = false;
    this.trigger(this.data);
  },

  // the method for fetching new data

  fetchData() {
    if (this.abortFetchData) {
      this.abortFetchData();
    }

    actions.library.searchMyLibraryAssets({
      searchPhrase: searchBoxStore.getSearchPhrase(),
      pageSize: this.PAGE_SIZE
    });
  },
});

export default myLibraryStore;
