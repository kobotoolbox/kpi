import {makeAutoObservable} from 'mobx';
import type {
  ProjectViewAsset,
  PaginatedResponse,
  FailResponse,
} from 'js/dataInterface';
import {notify} from 'js/utils';
import {ROOT_URL} from 'js/constants';
import type {ProjectsFilterDefinition} from './projectViews/constants';
import {buildQueriesFromFilters} from './projectViews/utils';

class CustomViewStore {
  public assets: ProjectViewAsset[] = [];
  public filters: ProjectsFilterDefinition[] = [];
  /** Whether the first call was made. */
  public isInitialised = false;
  public isLoading = false;
  private viewUid?: string;
  /** We use `null` here because the endpoint uses it. */
  private nextPageUrl: string | null = null;

  constructor() {
    makeAutoObservable(this);
  }

  /** Use this whenever you need to change the view */
  public setUp(viewUid: string) {
    this.viewUid = viewUid;
    this.assets = [];
    this.isInitialised = false;
    this.isLoading = false;
    this.nextPageUrl = null;
  }

  /** If next page of results is available. */
  public get hasMoreAssets(): boolean {
    return this.nextPageUrl !== null;
  }

  /** Stores the filters and fetches completely new list of assets. */
  public setFilters(filters: ProjectsFilterDefinition[]) {
    this.filters = filters;
    this.fetchAssets();
  }

  /**
   * Gets the first page of results. It will replace whatever assets are loaded
   * already.
   */
  public fetchAssets() {
    this.isInitialised = false;
    this.isLoading = true;
    this.assets = [];
    const queriesString = buildQueriesFromFilters(this.filters).join(' AND ');
    $.ajax({
      dataType: 'json',
      method: 'GET',
      url: `${ROOT_URL}/api/v2/project-views/${this.viewUid}/assets/?q=${queriesString}`,
    })
      .done(this.onFetchAssetsDone.bind(this))
      .fail(this.onAnyFail.bind(this));
  }

  /** Gets the next page of results (if available). */
  public fetchMoreAssets() {
    if (this.nextPageUrl !== null) {
      $.ajax({
        dataType: 'json',
        method: 'GET',
        url: this.nextPageUrl,
      })
        .done(this.onFetchMoreAssetsDone.bind(this))
        .fail(this.onAnyFail.bind(this));
    }
  }

  private onFetchAssetsDone(response: PaginatedResponse<ProjectViewAsset>) {
    this.isInitialised = true;
    this.isLoading = false;
    this.assets = response.results;
    this.nextPageUrl = response.next;
  }

  private onFetchMoreAssetsDone(response: PaginatedResponse<ProjectViewAsset>) {
    // This differs from `onFetchAssetsDone`, because it adds the Assets
    // to existing ones.
    this.isLoading = false;
    this.assets = this.assets.concat(response.results);
    this.nextPageUrl = response.next;
  }

  private onAnyFail(response: FailResponse) {
    this.isLoading = false;
    notify.error(response.responseText);
  }
}

/** Handles fetching (with filters and ordering) assets for given view. */
const customViewStore = new CustomViewStore();

export default customViewStore;
