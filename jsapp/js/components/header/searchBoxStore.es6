import Reflux from 'reflux';
import {hashHistory} from 'react-router';

const searchBoxStore = Reflux.createStore({
  init() {
    this.data = {
      searchPhrase: ''
    };

    this.previousPath = null;
    hashHistory.listen(this.onRouteChange.bind(this));
  },

  // manages clearing search when switching main routes
  onRouteChange(data) {
    if (
      this.previousPath !== null &&
      this.previousPath.split('/')[1] !== data.pathname.split('/')[1]
    ) {
      this.clear();
    }
    this.previousPath = data.pathname;
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
