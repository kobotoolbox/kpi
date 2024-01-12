export interface BaseProduct {
  id: string;
  name: string;
  description: string;
  type: string;
  metadata: Record<string, string>;
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
  items: Array<{price: BasePrice}>;
}

// There is probably a better way to hand the nested types
export interface Product extends BaseProduct {
  prices: BasePrice[];
}

export interface BaseProduct {
  id: string;
  name: string;
  description: string;
  type: string;
  metadata: {[p: string]: string};
}

export type RecurringInterval = 'year' | 'month';

export interface BasePrice {
  id: string;
  nickname: string;
  currency: string;
  type: string;
  unit_amount: number;
  human_readable_price: string;
  active: boolean;
  recurring?: {
    interval: RecurringInterval;
    aggregate_usage: string;
    interval_count: number;
    usage_type: 'metered' | 'licensed';
  };
  metadata: {[key: string]: string};
  product: BaseProduct;
  billing_scheme: 'per_unit' | 'tiered' | null;
  transform_quantity: null | {
    round: 'up' | 'down';
    divide_by: number;
  };
}

export interface BaseSubscription {
  id: number;
  price: Product;
  status: string;
  items: [{price: BasePrice}];
}

export interface Organization {
  id: string;
  name: string;
  is_active: boolean;
  created: string;
  modified: string;
  slug: string;
  owner: string;
}

export enum PlanNames {
  'FREE' = 'Community',
  'COMMUNITY' = 'Community',
  'PRO' = 'Professional',
  'ENTERPRISE' = 'Enterprise',
}

export enum Limits {
  'unlimited' = 'unlimited',
}

export type LimitAmount = number | 'unlimited';

export interface AccountLimit {
  submission_limit: LimitAmount;
  nlp_seconds_limit: LimitAmount;
  nlp_character_limit: LimitAmount;
  storage_bytes_limit: LimitAmount;
}

export interface Product extends BaseProduct {
  prices: BasePrice[];
}

export interface Price extends BaseProduct {
  prices: BasePrice;
}

export interface Checkout {
  url: string;
}

export enum ChangePlanStatus {
  'success' = 'success',
  'scheduled' = 'scheduled',
  'pending' = 'pending',
  'error' = 'error',
}

export type ChangePlan =
  | {
      status: ChangePlanStatus.success | ChangePlanStatus.pending;
      url: string;
      stripe_object: Record<string, string>;
    }
  | {
      status: ChangePlanStatus.scheduled;
    }
  | {
      status: ChangePlanStatus.error;
    };
