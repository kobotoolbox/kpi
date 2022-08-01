import {makeAutoObservable} from 'mobx';
import type {
  PaginatedResponse,
  FailResponse,
} from 'js/dataInterface';
import {notify} from 'js/utils';
import {ROOT_URL} from 'js/constants';

interface ListLanguageService {
  code: string;
  name: string;
}

export interface LanguageBase {
  /** API endpoint for detailed language data. */
  url: string;
  name: string;
  code: string;
  /** This marks the most popular and featured languages in UI. */
  featured: boolean;
}

interface ListLanguage extends LanguageBase {
  transcription_services: ListLanguageService[];
  translation_services: ListLanguageService[];
}

/**
 * NOTE: this requires to be initialized with `new` keyword! This is because
 * we can't handle multiple components using a single store instance in a nice
 * way. Each compoenent will have to have their own instance of `languageStore`.
 *
 * This store uses the `api/v2/languages` endpoint. It is designed to handle
 * one languages list at a time (filtering by search phrase and loading more
 * pages of results).
 */
class LanguagesStore {
  /** This list keeps the search results. */
  public languages: ListLanguage[] = [];
  public fullLanguages: Map<string, ListLanguage> = new Map();
  private nextPageUrl: string | null = null;
  public isInitialised = false;
  public isLoading = false;

  constructor() {
    makeAutoObservable(this);
  }

  /** Gets the first page of results filtered by search phrase. */
  public fetchLanguages(searchPhrase = '') {
    this.isLoading = true;
    $.ajax({
      dataType: 'json',
      method: 'GET',
      url: `${ROOT_URL}/api/v2/languages/?q=${searchPhrase}`,
    })
      .done(this.onFetchLanguagesDone.bind(this))
      .fail(this.onAnyFail.bind(this));
  }

  private onFetchLanguagesDone(response: PaginatedResponse<ListLanguage>) {
    this.isInitialised = true;
    this.isLoading = false;
    this.languages = response.results;
    this.nextPageUrl = response.next;
  }

  private onAnyFail(response: FailResponse) {
    this.isLoading = false;
    notify(response.responseText, 'error');
  }

  /** If next page of results is available for current search phrase. */
  public hasMoreLanguages(): boolean {
    return this.nextPageUrl !== null;
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
  }
}

export default LanguagesStore;

