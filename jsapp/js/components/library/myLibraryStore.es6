import Reflux from 'reflux';
import searchBoxStore from '../header/searchBoxStore';

const myLibraryStore = Reflux.createStore({
  init() {
    this.data = {
      q: searchBoxStore.getSearchPhrase()
    };

    this.listenTo(searchBoxStore, this.searchBoxStoreChanged);
  },

  searchBoxStoreChanged(data) {
    console.debug('searchBoxStoreChanged', data);
    this.fetchData();
  },

  fetchData() {
    // TODO
    this.onFetchDataCompleted();
  },

  onFetchDataCompleted() {
    this.trigger(this.data);
  }
});

export default myLibraryStore;
