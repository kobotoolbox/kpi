// Libraries
import $ from 'jquery';
import isEqual from 'lodash.isequal';
import {makeAutoObservable, reaction} from 'mobx';

// Stores and utilities
import {handleApiFail} from 'js/api';
import {buildQueriesFromFilters} from './projectViews/utils';
import session from 'js/stores/session';
import searchBoxStore from 'js/components/header/searchBoxStore';

// Constants and types
import type {
  AssetResponse,
  ProjectViewAsset,
  PaginatedResponse,
  FailResponse,
} from 'js/dataInterface';
import {DEFAULT_VISIBLE_FIELDS, PROJECT_FIELDS} from './projectViews/constants';
import type {
  ProjectFieldName,
  ProjectsFilterDefinition,
} from './projectViews/constants';
import type {ProjectsTableOrder} from './projectsTable/projectsTable';
import {COMMON_QUERIES} from 'js/constants';

const SAVE_DATA_NAME = 'project_views_settings';
const PAGE_SIZE = 50;

const DEFAULT_VIEW_SETTINGS: ViewSettings = {
  filters: [],
  order: {},
  // When fields are `undefined`, it means the deafult fields (from
  // `DEFAULT_PROJECT_FIELDS`) are being used.
  fields: undefined,
};

/** Settings of a different views to be stored on backend. */
export interface ProjectViewsSettings {
  [viewUid: string]: ViewSettings;
}

interface ViewSettings {
  filters: ProjectsFilterDefinition[];
  order: ProjectsTableOrder;
  fields?: ProjectFieldName[];
}

class CustomViewStore {
  public assets: ProjectViewAsset[] = [];
  public filters: ProjectsFilterDefinition[] = DEFAULT_VIEW_SETTINGS.filters;
  public order: ProjectsTableOrder = DEFAULT_VIEW_SETTINGS.order;
  public fields?: ProjectFieldName[] = DEFAULT_VIEW_SETTINGS.fields;
  /** Whether the first page call was made after setup. */
  public isFirstLoadComplete = false;
  public isLoading = false;
  /** This starts with some default value, but `setUp` overrides it. */
  public defaultVisibleFields: ProjectFieldName[] = DEFAULT_VISIBLE_FIELDS;
  /**
   * Please pass url with query parameters included, or simply ending with `?`.
   * This is the API url we want to call for given view. We have it here, so
   * that store would be able to handling both Project Views and My Projects
   * routes (as both of them use different APIs with same functionalities
   * available)
   */
  private baseUrl?: string;
  private viewUid?: string;
  /** We use `null` here because the endpoint uses it. */
  private nextPageUrl: string | null = null;
  private ongoingFetch?: JQuery.jqXHR;
  private searchContext?: string;
  private includeTypeFilter?: boolean;

  constructor() {
    makeAutoObservable(this);

    // Observe changes to searchBoxStore
    reaction(
      () => [
        searchBoxStore.data.context,
        searchBoxStore.data.searchPhrase,
        searchBoxStore.data.lastContextUpdateDate,
      ],
      () => {
        // We are only interested in changes within current context.
        if (searchBoxStore.data.context === this.searchContext) {
          this.fetchAssets();
        }
      }
    );
  }

  /**
   * NOTE: this causes `fetchAssets` to be called because we set new context for
   * `searchBoxStore` and it triggers a reaction.
   *
   * Use this method whenever you change view.
   */
  public setUp(
    viewUid: string,
    baseUrl: string,
    defaultVisibleFields: ProjectFieldName[],
    includeTypeFilter = true,
  ) {
    this.viewUid = viewUid;
    this.baseUrl = baseUrl;
    this.defaultVisibleFields = defaultVisibleFields;
    this.assets = [];
    this.isFirstLoadComplete = false;
    this.isLoading = false;
    this.nextPageUrl = null;
    this.includeTypeFilter = includeTypeFilter;
    this.loadSettings();

    this.searchContext = viewUid;
    // set up search box and trigger indirect fetch of new assets.
    searchBoxStore.setContext(viewUid);
  }

  /** If next page of results is available. */
  public get hasMoreAssets(): boolean {
    return this.nextPageUrl !== null;
  }

  /** Stores the new filters and fetches completely new list of assets. */
  public setFilters(filters: ProjectsFilterDefinition[]) {
    this.filters = filters;
    this.saveSettings();
    this.fetchAssets();
  }

  /** Stores the new ordering and fetches completely new list of assets. */
  public setOrder(order: ProjectsTableOrder) {
    this.order = order;
    this.saveSettings();
    this.fetchAssets();
  }

  public setFields(fields: ProjectFieldName[] | undefined) {
    this.fields = fields;
    this.saveSettings();
    // NOTE: we don't need to fetch assets again, fields are UI only
  }

  public hideField(fieldName: ProjectFieldName) {
    let newFields = Array.isArray(this.fields)
      ? Array.from(this.fields)
      : this.defaultVisibleFields;
    newFields = newFields.filter((item) => item !== fieldName);
    this.setFields(newFields);
  }

  /**
   * Returns an ordering value for current order property. Olivier said it best:
   * > `-name` is descending and `name` is ascending
   */
  private getOrderQuery() {
    if (!this.order?.fieldName) {
      return null;
    }

    const fieldDefinition =
      PROJECT_FIELDS[this.order.fieldName as ProjectFieldName];

    if (this.order.direction === 'descending') {
      return `-${fieldDefinition.apiOrderingName}`;
    }
    return fieldDefinition.apiOrderingName;
  }

  /**
   * Constructs all the parameters needed for the API call to fetch assets.
   * Left public for easier testing.
   */
  public constructFullQueryParams(url: URL) {
    const params = new URLSearchParams(url.search);

    // Step 1: Build queries for Back end (for `q=`).
    const queries = buildQueriesFromFilters(this.filters);

    // We are only interested in surveys, but some URLs will automatically add that query on the backend, so let the
    // caller decide if we need to add it explicitly
    if (this.includeTypeFilter) {
      queries.push(COMMON_QUERIES.s);
    }

    // Step 2: Add search query
    const searchPhrase = (searchBoxStore.data.searchPhrase ?? '').trim();
    if (searchPhrase !== '') {
      queries.push(searchPhrase);
    }
    if (queries.length > 0) {
      const queriesString = '(' + queries.join(') AND (') + ')';
      params.set('q', queriesString);
    }

    // Step 3: Build ordering string
    const orderingString = this.getOrderQuery();
    if (orderingString) {
      params.set('ordering', orderingString);
    }

    params.set('limit', String(PAGE_SIZE));

    return params;
  }

  /**
   * Gets the first page of results. It will replace whatever assets are loaded
   * already.
   */
  public fetchAssets() {
    if (!this.baseUrl) {
      return;
    }

    // Step 1: Cleanup and prepare store for getting new assets
    this.isFirstLoadComplete = false;
    this.isLoading = true;
    this.assets = [];

    // Step 2: Prepare url
    const url = new URL(this.baseUrl);
    const params = this.constructFullQueryParams(url)

    // Step 3: Stop any ongoing call (as it is no longer needed)
    if (this.ongoingFetch) {
      this.ongoingFetch.abort();
    }

    // Step 4: Make API call :)
    this.ongoingFetch = $.ajax({
      dataType: 'json',
      method: 'GET',
      url: `${url}?${params}`,
    })
      .done(this.onFetchAssetsDone.bind(this))
      .fail(this.onAnyFail.bind(this));
  }

  /** Gets the next page of results (if available). */
  public fetchMoreAssets() {
    if (this.nextPageUrl !== null) {
      if (this.ongoingFetch) {
        this.ongoingFetch.abort();
      }
      this.ongoingFetch = $.ajax({
        dataType: 'json',
        method: 'GET',
        url: this.nextPageUrl,
      })
        .done(this.onFetchMoreAssetsDone.bind(this))
        .fail(this.onAnyFail.bind(this));
    }
  }

  public handleAssetChanged(modifiedAsset: AssetResponse) {
    const originalAsset = this.assets.find(
      (asset: ProjectViewAsset) => modifiedAsset.uid === asset.uid
    );

    // Step 1: check if the asset is on the laoded list
    if (!originalAsset) {
      return;
    }

    // Step 2: check if any data that is being used by the table changed
    if (
      originalAsset.name !== modifiedAsset.name ||
      originalAsset.settings.description !==
        modifiedAsset.settings.description ||
      // Asset status consists of two properties
      originalAsset.has_deployment !== modifiedAsset.has_deployment ||
      originalAsset.deployment__active !== modifiedAsset.deployment__active ||
      // Owner information is also multiple props, but there is no way
      // of knowing whether `owner__email`, `owner__name` (full name), or
      // `owner__organization` have changed. Those pieces of information rarely
      // change, so there is no need to care about them here.
      originalAsset.owner !== modifiedAsset.owner ||
      originalAsset.owner__username !== modifiedAsset.owner__username ||
      originalAsset.date_modified !== modifiedAsset.date_modified ||
      // Date deployed is calculated for `ProjectViewAsset`, but for
      // `Asset Response` we need to find the last deployed version
      originalAsset.date_deployed !==
        modifiedAsset.deployed_versions?.results[0].date_modified ||
      !isEqual(originalAsset.settings.sector, modifiedAsset.settings.sector) ||
      !isEqual(
        originalAsset.settings.country,
        modifiedAsset.settings.country
      ) ||
      !isEqual(originalAsset.languages, modifiedAsset.summary.languages) ||
      originalAsset.deployment__submission_count !==
        modifiedAsset.deployment__submission_count
    ) {
      // At this point we know that one of the assets that was being displayed
      // on the list changed an important piece of data. We need to fetch data
      // again
      this.fetchAssets();
    }
  }

  public handleAssetsDeleted(deletedAssetsUids: string[]) {
    // When asset is deleted, we simply remove it from loaded assets list as it
    // seems there is no need to fetch all the data again
    this.assets = this.assets.filter(
      (asset: ProjectViewAsset) => !deletedAssetsUids.includes(asset.uid)
    );
  }

  private onFetchAssetsDone(response: PaginatedResponse<ProjectViewAsset>) {
    this.isFirstLoadComplete = true;
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
    handleApiFail(response);
  }

  /**
   * Stores settings for current view in `/me/` endpoint, so user will not lose
   * the configuration of the view after leaving the route.
   */
  private saveSettings() {
    if (!this.viewUid) {
      return;
    }

    let newData: ProjectViewsSettings = {};
    // Get saved data
    if (
      'email' in session.currentAccount &&
      session.currentAccount.extra_details.project_views_settings
    ) {
      newData = session.currentAccount.extra_details.project_views_settings;
    }

    newData[this.viewUid] = {
      filters: this.filters,
      order: this.order,
      fields: this.fields,
    };

    session.setDetail(SAVE_DATA_NAME, newData);
  }

  private resetSettings() {
    this.filters = DEFAULT_VIEW_SETTINGS.filters;
    this.order = DEFAULT_VIEW_SETTINGS.order;
    this.fields = DEFAULT_VIEW_SETTINGS.fields;
  }

  /**
   * Gets the settings for current view from session store (if they exists) with
   * fall back to defaults.
   */
  private loadSettings() {
    if (!this.viewUid) {
      return;
    }

    // First we load the default values
    this.resetSettings();

    // Then we load the saved settings (if they exist)
    if (
      'email' in session.currentAccount &&
      session.currentAccount.extra_details[SAVE_DATA_NAME]?.[this.viewUid]
    ) {
      const savedViewData =
        session.currentAccount.extra_details[SAVE_DATA_NAME][this.viewUid];
      if (savedViewData.filters) {
        this.filters = savedViewData.filters;
      }
      if (savedViewData.order?.direction && savedViewData.order?.fieldName) {
        this.order = savedViewData.order;
      }
      if (savedViewData.fields && Array.isArray(savedViewData.fields)) {
        this.fields = savedViewData.fields;
      }
    }
  }
}

/** Handles fetching (with filters and ordering) assets for given view. */
const customViewStore = new CustomViewStore();

export default customViewStore;
