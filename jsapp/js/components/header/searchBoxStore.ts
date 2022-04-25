import Reflux from 'reflux';
import type {Location} from 'history';
import {hashHistory} from 'react-router';
import {
  getCurrentPath,
  isMyLibraryRoute,
  isPublicCollectionsRoute,
} from 'js/router/routerUtils';

const DEFAULT_SEARCH_PHRASE = '';

type SearchBoxContextName = 'MY_LIBRARY' | 'PUBLIC_COLLECTIONS';

export const SEARCH_CONTEXTS: {
  [name in SearchBoxContextName]: SearchBoxContextName
} = {
  MY_LIBRARY: 'MY_LIBRARY',
  PUBLIC_COLLECTIONS: 'PUBLIC_COLLECTIONS',
};

interface SearchBoxStoreData {
  context: SearchBoxContextName | null;
  searchPhrase: string;
}

class SearchBoxStore extends Reflux.Store {
  previousPath = getCurrentPath();
  data: SearchBoxStoreData = {
    context: null,
    searchPhrase: DEFAULT_SEARCH_PHRASE,
  };

  init() {
    hashHistory.listen(this.onRouteChange.bind(this));
    this.resetContext();
  }

  // manages clearing search when switching main routes
  onRouteChange(data: Location) {
    if (this.previousPath.split('/')[1] !== data.pathname.split('/')[1]) {
      this.clear();
    }
    this.previousPath = data.pathname;

    this.resetContext();
  }

  getSearchPhrase() {
    return this.data.searchPhrase;
  }

  setSearchPhrase(newVal: string) {
    if (this.data.searchPhrase !== newVal) {
      this.data.searchPhrase = newVal;
      this.trigger(this.data);
    }
  }

  getContext() {
    return this.data.context;
  }

  resetContext() {
    let newContext: SearchBoxContextName | null = null;

    if (isMyLibraryRoute()) {
      newContext = 'MY_LIBRARY';
    } else if (isPublicCollectionsRoute()) {
      newContext = 'PUBLIC_COLLECTIONS';
    }

    if (this.data.context !== newContext) {
      this.data.context = newContext;
      this.data.searchPhrase = DEFAULT_SEARCH_PHRASE;
      this.trigger(this.data);
    }
  }

  clear() {
    this.setSearchPhrase(DEFAULT_SEARCH_PHRASE);
  }
}

const searchBoxStore = new SearchBoxStore();
searchBoxStore.init();

export default searchBoxStore;
