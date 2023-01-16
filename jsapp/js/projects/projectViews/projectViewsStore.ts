import {makeAutoObservable} from 'mobx';
import {handleApiFail} from 'js/utils';
import {ROOT_URL} from 'js/constants';
import type {PaginatedResponse} from 'js/dataInterface';
import {fetchGet} from 'js/api';

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
    this.fetchData();
  }

  public getView(uid: string) {
    return this.views.find((view) => view.uid === uid);
  }

  public fetchData() {
    fetchGet<PaginatedResponse<ProjectView>>(
      `${ROOT_URL}/api/v2/project-views/`
    ).then(this.onFetchDataDone.bind(this), handleApiFail);
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
