import {when} from 'mobx';
import type {SubscriptionInfo} from 'js/account/subscriptionStore';
import subscriptionStore from 'js/account/subscriptionStore';
import {endpoints} from 'js/api.endpoints';
import {ACTIVE_STRIPE_STATUSES} from 'js/constants';
import type {PaginatedResponse} from 'js/dataInterface';
import envStore from 'js/envStore';
import {fetchGet, fetchPost} from 'jsapp/js/api';

export interface BaseProduct {
  id: string;
  name: string;
  description: string;
  type: string;
  metadata: {[key: string]: string};
}

export type RecurringInterval = 'year' | 'month';

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
    usage_type: 'metered' | 'licensed';
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
  await when(() => envStore.isReady);
  if (envStore.data.stripe_public_key) {
    if (!subscriptionStore.isPending && !subscriptionStore.isInitialised) {
      subscriptionStore.fetchSubscriptionInfo();
    }
    await when(() => subscriptionStore.isInitialised);
    const subscriptionList: SubscriptionInfo[] = subscriptionStore.planResponse;
    const activeSubscription = subscriptionList.find((sub) =>
      ACTIVE_STRIPE_STATUSES.includes(sub.status)
    );
    if (activeSubscription) {
      return activeSubscription.items[0].price.recurring?.interval;
    }
  }
  return 'month';
}

const DEFAULT_LIMITS: AccountLimit = Object.freeze({
  submission_limit: 'unlimited',
  nlp_seconds_limit: 'unlimited',
  nlp_character_limit: 'unlimited',
  storage_bytes_limit: 'unlimited',
});

function getLimitsForMetadata(
  metadata: {[key: string]: string},
  limitsToCompare: false | AccountLimit = false
) {
  const limits: Partial<AccountLimit> = {};
  for (const [key, value] of Object.entries(metadata)) {
    // if we need to compare limits, make sure we're not overwriting a higher limit from somewhere else
    if (limitsToCompare) {
      if (
        !limitsToCompare?.[key as keyof AccountLimit] ||
        (value !== 'unlimited' &&
          value <= limitsToCompare[key as keyof AccountLimit])
      ) {
        continue;
      }
    }
    // only use metadata needed for limit calculations
    if (key in DEFAULT_LIMITS) {
      limits[key as keyof AccountLimit] =
        value === 'unlimited' ? value : parseInt(value);
    }
  }
  return limits;
}

const getFreeTierLimits = async (limits: AccountLimit) => {
  await when(() => envStore.isReady);
  const thresholds = envStore.data.free_tier_thresholds;
  const newLimits: AccountLimit = {...limits};
  thresholds.storage && (newLimits['storage_bytes_limit'] = thresholds.storage);
  thresholds.data && (newLimits['submission_limit'] = thresholds.data);
  thresholds.translation_chars &&
    (newLimits['nlp_character_limit'] = thresholds.translation_chars);
  thresholds.transcription_minutes &&
    (newLimits['nlp_seconds_limit'] = thresholds.transcription_minutes * 60);
  return newLimits;
};

const getRecurringAddOnLimits = (limits: AccountLimit) => {
  let newLimits = {...limits};
  let activeAddOns = [...subscriptionStore.addOnsResponse];
  let metadata = {};
  activeAddOns = activeAddOns.filter((subscription) =>
    ACTIVE_STRIPE_STATUSES.includes(subscription.status)
  );
  if (activeAddOns.length) {
    activeAddOns.forEach((addOn) => {
      metadata = {
        ...addOn.items[0].price.product.metadata,
        ...addOn.items[0].price.metadata,
      };
      newLimits = {...newLimits, ...getLimitsForMetadata(metadata, newLimits)};
    });
  }
  return newLimits;
};

const getStripeMetadataAndFreeTierStatus = async () => {
  await when(() => subscriptionStore.isInitialised);
  const plans = [...subscriptionStore.planResponse];
  const activeSubscriptions = plans.filter((subscription) =>
    ACTIVE_STRIPE_STATUSES.includes(subscription.status)
  );
  let metadata;
  let hasFreeTier = false;
  if (activeSubscriptions.length) {
    // get metadata from the user's subscription (prioritize price metadata over product metadata)
    metadata = {
      ...activeSubscriptions[0].items[0].price.product.metadata,
      ...activeSubscriptions[0].items[0].price.metadata,
    };
  } else {
    // the user has no subscription, so get limits from the free monthly price
    hasFreeTier = true;
    try {
      const products = await getProducts();
      const freeProduct = products.results.filter((product) =>
        product.prices.filter(
          (price: BasePrice) =>
            price.unit_amount === 0 && price.recurring?.interval === 'month'
        )
      )[0];
      metadata = {
        ...freeProduct.metadata,
        ...freeProduct.prices[0].metadata,
      };
    } catch (error) {
      metadata = {};
    }
  }
  return {metadata, hasFreeTier};
};

export async function getAccountLimits() {
  const {metadata, hasFreeTier} = await getStripeMetadataAndFreeTierStatus();

  // initialize to unlimited
  let limits: AccountLimit = {...DEFAULT_LIMITS};

  // apply any limits from the metadata
  limits = {...limits, ...getLimitsForMetadata(metadata)};

  if (hasFreeTier) {
    // if the user is on the free tier, overwrite their limits with whatever free tier limits exist
    limits = await getFreeTierLimits(limits);

    // if the user has active recurring add-ons, use those as the final say on their limits
    limits = getRecurringAddOnLimits(limits);
  }

  return limits;
}
