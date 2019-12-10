import Reflux from 'reflux';
import searchBoxStore from '../header/searchBoxStore';

const myLibraryStore = Reflux.createStore({
  init() {
    this.state = {
      q: searchBoxStore.getSearchPhrase()
    };

    this.listenTo(searchBoxStore, this.searchBoxStoreChanged);
  },

  searchBoxStoreChanged(data) {
    console.debug('searchBoxStoreChanged', data);
  }
});

export default myLibraryStore;
