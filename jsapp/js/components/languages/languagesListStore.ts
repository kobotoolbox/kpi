import {makeAutoObservable} from 'mobx';
import type {PaginatedResponse, FailResponse} from 'js/dataInterface';
import {handleApiFail} from 'js/api';
import {ROOT_URL} from 'js/constants';
import languagesStore from './languagesStore';
import type {ListLanguage} from './languagesStore';

/**
 * NOTE: this requires to be initialized with `new` keyword! This is because
 * we can't handle multiple components using a single search store instance in
 * a nice way. Each component will have to instantialise their own store.
 *
 * This store uses the `api/v2/languages` endpoint. It is designed to handle
 * one languages list at a time (filtering by search phrase and loading more
 * pages of results).
 */
export default class LanguagesListStore {
  /** This list keeps the search results. */
  public languages: ListLanguage[] = [];
  /** Whether the first call was made. */
  public isInitialised = false;
  public isLoading = false;
  private nextPageUrl: string | null = null;

  constructor() {
    makeAutoObservable(this);
  }

  /** If next page of results is available for current search phrase. */
  public get hasMoreLanguages(): boolean {
    return this.nextPageUrl !== null;
  }

  /** Gets the first page of results filtered by search phrase. */
  public fetchLanguages(searchPhrase = '') {
    this.isLoading = true;
    $.ajax({
      dataType: 'json',
      method: 'GET',
      url:
        `${ROOT_URL}/api/v2/languages/` +
        (searchPhrase ? `?q=${searchPhrase}` : ''),
    })
      .done(this.onFetchLanguagesDone.bind(this))
      .fail(this.onAnyFail.bind(this));
  }

  private onFetchLanguagesDone(response: PaginatedResponse<ListLanguage>) {
    this.isInitialised = true;
    this.isLoading = false;
    this.languages = response.results;
    this.nextPageUrl = response.next;
    this.memoizeLanguages();
  }

  private onAnyFail(response: FailResponse) {
    this.isLoading = false;
    handleApiFail(response);
  }

  /** Gets the next page of results (if available). */
  public fetchMoreLanguages() {
    if (this.nextPageUrl !== null) {
      $.ajax({
        dataType: 'json',
        method: 'GET',
        url: this.nextPageUrl,
      })
        .done(this.onFetchMoreLanguagesDone.bind(this))
        .fail(this.onAnyFail.bind(this));
    }
  }

  private onFetchMoreLanguagesDone(response: PaginatedResponse<ListLanguage>) {
    // This differs from `onFetchLanguagesDone`, because it adds the languages
    // to existing ones.
    this.isLoading = false;
    this.languages = this.languages.concat(response.results);
    this.nextPageUrl = response.next;
    this.memoizeLanguages();
  }

  private memoizeLanguages() {
    languagesStore.setListLanguages(this.languages);
  }
}
