import {fetchGet, fetchPost} from 'jsapp/js/api';
import type {PaginatedResponse} from 'js/dataInterface';
import {endpoints} from 'js/api.endpoints';
import {ACTIVE_STRIPE_STATUSES} from 'js/constants';
import envStore from 'js/envStore';
import {when} from 'mobx';
import type {SubscriptionInfo} from 'js/account/subscriptionStore';
import subscriptionStore from 'js/account/subscriptionStore';

export interface BaseProduct {
  id: string;
  name: string;
  description: string;
  type: string;
  metadata: {[key: string]: string};
}

export enum RecurringInterval {
  Year = 'year',
  Month = 'month',
}

enum UsageType {
  Metered = 'metered',
  Licensed = 'licensed',
}

export interface BasePrice {
  id: string;
  nickname: string;
  currency: string;
  type: string;
  unit_amount: number;
  human_readable_price: string;
  recurring?: {
    interval: RecurringInterval;
    aggregate_usage: string;
    interval_count: number;
    usage_type: UsageType;
  };
  metadata: {[key: string]: string};
  product: BaseProduct;
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
}

export interface AccountLimit {
  submission_limit: 'unlimited' | number;
  nlp_seconds_limit: 'unlimited' | number;
  nlp_character_limit: 'unlimited' | number;
  storage_bytes_limit: 'unlimited' | number;
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

export interface Portal {
  url: string;
}

export async function getProducts() {
  return fetchGet<PaginatedResponse<Product>>(endpoints.PRODUCTS_URL);
}

export async function getSubscription() {
  return fetchGet<PaginatedResponse<BaseSubscription>>(
    endpoints.SUBSCRIPTION_URL
  );
}

export async function getOrganization() {
  return fetchGet<PaginatedResponse<Organization>>(endpoints.ORGANIZATION_URL);
}

export async function postCheckout(priceId: string, organizationId: string) {
  return fetchPost<Checkout>(
    `${endpoints.CHECKOUT_URL}?price_id=${priceId}&organization_id=${organizationId}`,
    {}
  );
}

export async function postCustomerPortal(organizationId: string) {
  return fetchPost<Portal>(
    `${endpoints.PORTAL_URL}?organization_id=${organizationId}`,
    {}
  );
}

export async function getSubscriptionInterval() {
  await when(() => envStore.isReady && subscriptionStore.isLoaded);
  if (envStore.data.stripe_public_key) {
    const subscriptionList: SubscriptionInfo[] =
      subscriptionStore.subscriptionResponse;
    const activeSubscription = subscriptionList.find((sub) =>
      ACTIVE_STRIPE_STATUSES.includes(sub.status)
    );
    if (activeSubscription) {
      return activeSubscription.items[0].price.recurring?.interval;
    }
  }
  return null;
}

export async function getAccountLimits() {
  await when(() => subscriptionStore.isLoaded);
  const subscriptions = [...subscriptionStore.subscriptionResponse];
  const activeSubscriptions = subscriptions.filter((subscription) =>
    ACTIVE_STRIPE_STATUSES.includes(subscription.status)
  );
  let metadata;
  if (activeSubscriptions.length) {
    // get limit data from the user's subscription
    metadata = activeSubscriptions[0].items[0].price.metadata;
  } else {
    // the user has no subscription, so get limits from the free monthly price
    const products = await getProducts();
    const freeProduct = products.results.filter((product) =>
      product.prices.filter(
        (price: BasePrice) =>
          price.unit_amount === 0 &&
          price.recurring?.interval === RecurringInterval.Month
      )
    );
    metadata = {
      ...freeProduct[0].metadata,
      ...freeProduct[0].prices[0].metadata,
    };
  }
  const limits: AccountLimit = {
    submission_limit: 'unlimited',
    nlp_seconds_limit: 'unlimited',
    nlp_character_limit: 'unlimited',
    storage_bytes_limit: 'unlimited',
  };
  for (const [key, value] of Object.entries(metadata)) {
    if (Object.keys(limits).includes(key)) {
      limits[key as keyof AccountLimit] =
        value === 'unlimited' ? value : parseInt(value);
    }
  }
  await when(() => envStore.isReady);
  const thresholds = envStore.data.free_tier_thresholds;
  thresholds.storage
    ? (limits['storage_bytes_limit'] = thresholds.storage)
    : null;
  thresholds.data ? (limits['submission_limit'] = thresholds.data) : null;
  thresholds.translation_chars
    ? (limits['nlp_character_limit'] = thresholds.translation_chars)
    : null;
  thresholds.transcription_minutes
    ? (limits['nlp_seconds_limit'] = thresholds.transcription_minutes * 60)
    : null;
  return limits;
}
