import Reflux from 'reflux';

const searchBoxStore = Reflux.createStore({
  init() {
    this.data = {
      searchPhrase: ''
    };
  },

  getSearchPhrase() {
    return this.data.searchPhrase;
  },

  setSearchPhrase(newVal) {
    if (this.data.searchPhrase !== newVal) {
      this.data.searchPhrase = newVal;
      this.trigger(this.data);
    }
  },

  clear() {
    this.setSearchPhrase('');
  }
});

export default searchBoxStore;
