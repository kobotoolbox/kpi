import {makeAutoObservable} from 'mobx';
import {notify} from 'js/utils';
import {ROOT_URL} from 'js/constants';
import type {PaginatedResponse, FailResponse} from 'js/dataInterface';

export interface ProjectView {
  uid: string;
  name: string;
  url: string;
  assets: string;
  assets_export: string;
  users: string;
  users_export: string;
  /** List of country codes (same codes as in `envStore`), */
  countries: string[];
  permissions: string[];
  assigned_users: string[];
}

class ProjectViewsStore {
  public views: ProjectView[] = [];
  public isInitialised = false;

  constructor() {
    makeAutoObservable(this);
    this.fetchData();
  }

  public getView(uid: string) {
    return this.views.find((view) => view.uid === uid);
  }

  private fetchData() {
    $.ajax({
      dataType: 'json',
      method: 'GET',
      url: `${ROOT_URL}/api/v2/project-views/`,
    })
      .done(this.onFetchDataDone.bind(this))
      .fail(this.onFetchDataFail.bind(this));
  }

  private onFetchDataDone(response: PaginatedResponse<ProjectView>) {
    this.views = response.results;
    this.isInitialised = true;
  }

  private onFetchDataFail(response: FailResponse) {
    notify.error(response.responseText);
  }
}

/**
 * Keeps a list of available views. Fetches data only once during the lifetime
 * of the app.
 */
const projectViewsStore = new ProjectViewsStore();

export default projectViewsStore;
