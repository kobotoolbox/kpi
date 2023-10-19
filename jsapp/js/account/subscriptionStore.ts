import {makeAutoObservable} from 'mobx';
import {handleApiFail} from 'js/utils';
import {ACTIVE_STRIPE_STATUSES, ROOT_URL} from 'js/constants';
import {fetchGet} from 'jsapp/js/api';
import type {PaginatedResponse} from 'js/dataInterface';
import {BasePrice} from 'js/account/stripe.api';

const PRODUCTS_URL = '/api/v2/stripe/products/';
// For plan displaying purposes we only care about this part of the response
export interface BaseProduct {
  id: string;
  name: string;
  description: string;
  type: string;
  metadata: any;
}

export interface PlanInfo {
  product: BaseProduct;
  djstripe_created: string;
  djstripe_updated: string;
  id: string;
  livemode: boolean;
  created: string;
  metadata: {};
  description: string;
  active: boolean;
  aggregate_usage: string;
  amount: string;
  amount_decimal: string;
  billing_scheme: string;
  currency: string;
  interval: string;
  interval_count: 1;
  nickname: string;
  tiers: any;
  tiers_mode: string;
  transform_usage: any;
  trial_period_days: any;
  usage_type: string;
  djstripe_owner_account: string;
}

interface SubscriptionPhase {
  items: [
    {
      plan: string;
      price: string;
      metadata: Record<string, string>;
      quantity: number;
      tax_rates: [number];
      billing_thresholds: Record<string, string>;
    }
  ];
  coupon: null;
  currency: string;
  end_date: number | null;
  metadata: {};
  trial_end: number | null;
  start_date: number | null;
  description: string | null;
  on_behalf_of: string | null;
  automatic_tax: {
    enabled: boolean;
  };
  transfer_data: string | null;
  invoice_settings: string | null;
  add_invoice_items: [];
  collection_method: string | null;
  default_tax_rates: [];
  billing_thresholds: null;
  proration_behavior: string;
  billing_cycle_anchor: number | null;
  default_payment_method: string | null;
  application_fee_percent: number | null;
}

interface SubscriptionSchedule {
  phases: SubscriptionPhase[] | null;
  status: 'not_started' | 'active' | 'completed' | 'released' | 'canceled';
}

export interface SubscriptionInfo {
  plan: PlanInfo;
  djstripe_created: string;
  djstripe_updated: string;
  id: string;
  livemode: boolean;
  created: string;
  metadata: {};
  description: string;
  application_fee_percent: any;
  billing_cycle_anchor: string;
  billing_thresholds: any;
  cancel_at: any;
  cancel_at_period_end: boolean;
  canceled_at: any;
  collection_method: string;
  current_period_end: string;
  current_period_start: string;
  days_until_due: any;
  discount: any;
  ended_at: any;
  next_pending_invoice_item_invoice: any;
  pending_invoice_item_interval: any;
  pending_update: any;
  quantity: 1;
  start_date: string;
  status: string;
  trial_end: any;
  trial_start: any;
  djstripe_owner_account: string;
  customer: string;
  default_payment_method: string;
  default_source: any;
  latest_invoice: string;
  pending_setup_intent: any;
  schedule: SubscriptionSchedule;
  default_tax_rates: [];
  items: {price: BasePrice}[];
}

// There is probably a better way to hand the nested types
export interface Product extends BaseProduct {
  prices: Array<PlanInfo>;
}

export async function fetchProducts() {
  return fetchGet<PaginatedResponse<Product>>(PRODUCTS_URL);
}

class SubscriptionStore {
  public planResponse: SubscriptionInfo[] = [];
  public addOnsResponse: SubscriptionInfo[] = [];
  public activeSubscriptions: SubscriptionInfo[] = [];
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
        handleApiFail(response);
      });
  }

  private onFetchSubscriptionInfoDone(
    response: PaginatedResponse<SubscriptionInfo>
  ) {
    // get all active subscriptions for the user
    this.activeSubscriptions = response.results.filter((sub) =>
      ACTIVE_STRIPE_STATUSES.includes(sub.status)
    );
    // get any active plan subscriptions for the user
    this.planResponse = this.activeSubscriptions.filter(
      (sub) => sub.items[0]?.price.product.metadata?.product_type == 'plan'
    );
    // get any active recurring add-on subscriptions for the user
    this.addOnsResponse = this.activeSubscriptions.filter(
      (sub) => sub.items[0]?.price.product.metadata?.product_type == 'addon'
    );

    this.isPending = false;
    this.isInitialised = true;
  }
}

export default new SubscriptionStore();
