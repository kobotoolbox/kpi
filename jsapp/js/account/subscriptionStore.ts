import {makeAutoObservable} from 'mobx';
import {handleApiFail, fetchGet} from 'js/api';
import {ACTIVE_STRIPE_STATUSES, ROOT_URL} from 'js/constants';
import type {PaginatedResponse} from 'js/dataInterface';
import {PlanNames, type Product, type SubscriptionInfo} from 'js/account/stripe.types';
import envStore from 'js/envStore';

const PRODUCTS_URL = '/api/v2/stripe/products/';

export async function fetchProducts() {
  return fetchGet<PaginatedResponse<Product>>(PRODUCTS_URL);
}

class SubscriptionStore {
  public planResponse: SubscriptionInfo[] = [];
  public addOnsResponse: SubscriptionInfo[] = [];
  public activeSubscriptions: SubscriptionInfo[] = [];
  public canceledPlans: SubscriptionInfo[] = [];
  public isPending = false;
  public isInitialised = false;

  constructor() {
    makeAutoObservable(this);
  }

  public fetchSubscriptionInfo() {
    if (this.isPending) {
      return;
    }
    this.isPending = true;
    this.isInitialised = false;
    $.ajax({
      dataType: 'json',
      method: 'GET',
      url: `${ROOT_URL}/api/v2/stripe/subscriptions/`,
    })
      .done(this.onFetchSubscriptionInfoDone.bind(this))
      .fail((response) => {
        this.isPending = false;
        handleApiFail(
          response,
          t('There was an issue fetching your plan information.')
        );
      });
  }

  /*
   * The plan name displayed to the user. This will display, in order of precedence:
   * * The user's active plan subscription
   * * The FREE_TIER_DISPLAY["name"] setting (if the user registered before FREE_TIER_CUTOFF_DATE
   * * The free plan
   */
  public get planName() {
    if (
      this.planResponse.length &&
      this.planResponse[0].items.length
    ) {
      return this.planResponse[0].items[0].price.product.name;
    }
    return envStore.data?.free_tier_display?.name || PlanNames.FREE;
  }

  private onFetchSubscriptionInfoDone(
    response: PaginatedResponse<SubscriptionInfo>
  ) {
    // get all active subscriptions for the user
    this.activeSubscriptions = response.results.filter((sub) =>
      ACTIVE_STRIPE_STATUSES.includes(sub.status)
    );
    this.canceledPlans = response.results.filter(
      (sub) =>
        sub.items[0]?.price.product.metadata?.product_type === 'plan' &&
        sub.status === 'canceled'
    );
    // get any active plan subscriptions for the user
    this.planResponse = this.activeSubscriptions.filter(
      (sub) => sub.items[0]?.price.product.metadata?.product_type === 'plan'
    );
    // get any active recurring add-on subscriptions for the user
    this.addOnsResponse = this.activeSubscriptions.filter(
      (sub) => sub.items[0]?.price.product.metadata?.product_type === 'addon'
    );

    this.isPending = false;
    this.isInitialised = true;
  }
}

export default new SubscriptionStore();
