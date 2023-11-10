import $ from 'jquery';
import {makeAutoObservable, when} from 'mobx';
import {handleApiFail} from 'js/api';
import type {PaginatedResponse} from 'js/dataInterface';
import {ROOT_URL} from 'js/constants';
import sessionStore from 'js/stores/session';

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
  public isFirstLoadComplete = false;

  constructor() {
    makeAutoObservable(this);
    when(
      () => sessionStore.isLoggedIn,
      () => this.fetchData()
    );
  }

  public getView(uid: string) {
    return this.views.find((view) => view.uid === uid);
  }

  public fetchData() {
    $.ajax({
      dataType: 'json',
      method: 'GET',
      url: `${ROOT_URL}/api/v2/project-views/`,
    })
      .done(this.onFetchDataDone.bind(this))
      .fail(handleApiFail);
  }

  private onFetchDataDone(response: PaginatedResponse<ProjectView>) {
    this.views = response.results;
    this.isFirstLoadComplete = true;
  }
}

/**
 * Keeps a list of available views. Fetches data only once during the lifetime
 * of the app.
 */
const projectViewsStore = new ProjectViewsStore();

export default projectViewsStore;
