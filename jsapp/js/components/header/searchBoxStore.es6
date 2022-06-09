import Reflux from 'reflux';
import {hashHistory} from 'react-router';
import {
  getCurrentPath,
  isMyLibraryRoute,
  isPublicCollectionsRoute,
} from 'js/router/routerUtils';
import {createEnum} from 'js/constants';

const DEFAULT_SEARCH_PHRASE = '';

export const SEARCH_CONTEXTS = createEnum([
  'MY_LIBRARY',
  'PUBLIC_COLLECTIONS',
]);

export const searchBoxStore = Reflux.createStore({
  previousPath: getCurrentPath(),
  data: {
    context: null,
    searchPhrase: DEFAULT_SEARCH_PHRASE,
  },

  init() {
    hashHistory.listen(this.onRouteChange.bind(this));
    this.resetContext();
  },

  // manages clearing search when switching main routes
  onRouteChange(data) {
    if (this.previousPath.split('/')[1] !== data.pathname.split('/')[1]) {
      this.clear();
    }
    this.previousPath = data.pathname;

    this.resetContext();
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

  getContext() {
    return this.data.context;
  },

  resetContext() {
    let newContext = null;

    if (isMyLibraryRoute()) {
      newContext = SEARCH_CONTEXTS.MY_LIBRARY;
    } else if (isPublicCollectionsRoute()) {
      newContext = SEARCH_CONTEXTS.PUBLIC_COLLECTIONS;
    }

    if (this.data.context !== newContext) {
      this.data.context = newContext;
      this.data.searchPhrase = DEFAULT_SEARCH_PHRASE;
      this.trigger(this.data);
    }
  },

  clear() {
    this.setSearchPhrase(DEFAULT_SEARCH_PHRASE);
  },
});
