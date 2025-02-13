import {makeAutoObservable} from 'mobx';

interface SearchBoxStoreData {
  /** Context ensures that observers will not be triggered unnecessarily. */
  context?: string;
  /**
   * Keeps the date of last update to the store. We use it to be able to react
   * in a more forceful way to store changes.
   */
  lastContextUpdateDate?: number;
  /**
   * Intentionally left unset by default, so reactions are being called when
   * the app is initialized.
   */
  searchPhrase?: string;
}

/**
 * This store is responsible for storing search phrase. It can receive it from
 * different sources, but is built with `SearchBox` component in mind.
 *
 * It can provide the search phrase for just one receiver at a time. This is
 * enforced by the `context` property.
 *
 * To use it, set it up with `setContext` during receiving (route) component
 * initialization. Do it before using the search phrase for any calls. Also
 * ensure `SearchBox` component is present and you observe the store changes.
 */
class SearchBoxStore {
  data: SearchBoxStoreData = {};

  constructor() {
    makeAutoObservable(this);
  }

  /** This method is for the SearchBox component. */
  public setSearchPhrase(newVal: string) {
    if ((this.data.searchPhrase ?? '').trim() !== newVal.trim()) {
      this.data.searchPhrase = newVal;
    }
  }

  /**
   * This method is for every component interested in using SearchBoxStore.
   * When such component loads, it should register itself (take over) with
   * unique context id.
   */
  public setContext(newContext: string) {
    this.data.context = newContext;
    this.data.lastContextUpdateDate = Date.now();
    // Changing context resets the search phrase
    this.data.searchPhrase = '';
  }
}

export default new SearchBoxStore();
