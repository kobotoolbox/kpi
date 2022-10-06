import {makeAutoObservable} from 'mobx';
import {notify} from 'js/utils';
import {ROOT_URL} from 'js/constants';

export interface AssetUsage {
  asset: string;
  asset__name: string;
  submission_count_current_month: number;
  submission_count_all_time: number;
  storage_bytes: number;
}

class PlanRouteStore {
  public usageSubmissionsMonthly = 0;
  public usageStorage = 0;
  // These are not used in UI yet but is returned to us via the same endpoint
  public usageSubmissionsTotal = 0;
  public usagePerAsset: AssetUsage[] = [];

  constructor() {
    makeAutoObservable(this);
    this.fetchDataUsage();
  }

  public fetchDataUsage() {
    $.ajax({
      dataType: 'json',
      method: 'GET',
      url: `${ROOT_URL}/api/v2/service_usage`,
    })
      .done(this.onFetchDataUsageDone.bind(this))
      .fail(this.onFetchDataUsageFail.bind(this));
  }

  private onFetchDataUsageDone(response: any) {
    this.usageSubmissionsTotal = response.total_submission_count_all_time;
    this.usageSubmissionsMonthly =
      response.total_submission_count_current_month;
    this.usageStorage = response.total_storage_bytes;
  }

  private onFetchDataUsageFail(response: any) {
    notify.error(response);
  }
}

export default new PlanRouteStore();
