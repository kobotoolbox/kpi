import {when} from 'mobx';
import subscriptionStore from 'js/account/subscriptionStore';
import {endpoints} from 'js/api.endpoints';
import {ACTIVE_STRIPE_STATUSES} from 'js/constants';
import type {PaginatedResponse} from 'js/dataInterface';
import envStore from 'js/envStore';
import {fetchGet, fetchPost} from 'jsapp/js/api';
import type {
  AccountLimit,
  ChangePlan,
  Checkout,
  OneTimeAddOn,
  PriceMetadata,
  Product,
} from 'js/account/stripe.types';
import {Limits} from 'js/account/stripe.types';
import {getAdjustedQuantityForPrice} from 'js/account/stripe.utils';

const DEFAULT_LIMITS: AccountLimit = Object.freeze({
  submission_limit: Limits.unlimited,
  asr_seconds_limit: Limits.unlimited,
  mt_characters_limit: Limits.unlimited,
  storage_bytes_limit: Limits.unlimited,
});

export async function getProducts() {
  return fetchGet<PaginatedResponse<Product>>(endpoints.PRODUCTS_URL, {
    errorMessageDisplay: t('There was an error getting the list of plans.'),
  });
}

export async function getOneTimeAddOns() {
  return fetchGet<PaginatedResponse<OneTimeAddOn>>(endpoints.ADD_ONS_URL, {
    errorMessageDisplay: t('There was an error getting one-time add-ons.'),
  });
}

export async function changeSubscription(
  price_id: string,
  subscription_id: string,
  quantity = 1
) {
  const params = new URLSearchParams({
    price_id,
    subscription_id,
    quantity: quantity.toString(),
  });
  return fetchGet<ChangePlan>(`${endpoints.CHANGE_PLAN_URL}?${params}`, {
    errorMessageDisplay: t(
      "We couldn't make the requested change to your plan.\nYour current plan has not been changed."
    ),
  });
}

/**
 * Start a checkout session for the given price and organization. Response contains the checkout URL.
 */
export async function postCheckout(
  priceId: string,
  organizationId: string,
  quantity = 1
) {
  return fetchPost<Checkout>(
    `${endpoints.CHECKOUT_URL}?price_id=${priceId}&organization_id=${organizationId}&quantity=${quantity}`,
    {},
    {
      errorMessageDisplay:
        'There was an error creating the checkout session. Please try again later.',
    }
  );
}

/**
 * Get the URL of the Stripe customer portal for an organization.
 */
export async function postCustomerPortal(
  organizationId: string,
  priceId = '',
  quantity = 1
) {
  return fetchPost<Checkout>(
    `${endpoints.PORTAL_URL}?organization_id=${organizationId}&price_id=${priceId}&quantity=${quantity}`,
    {},
    {
      errorMessageDisplay:
        'There was an error sending you to the billing portal. Please try again later.',
    }
  );
}

/**
 * Get the subscription interval (`'month'` or `'year'`) for the logged-in user.
 * Returns `'month'` for users on the free plan.
 */
export async function getSubscriptionInterval() {
  await when(() => envStore.isReady);
  if (envStore.data.stripe_public_key) {
    if (!subscriptionStore.isPending && !subscriptionStore.isInitialised) {
      subscriptionStore.fetchSubscriptionInfo();
    }
    await when(() => subscriptionStore.isInitialised);
    const subscriptionList = subscriptionStore.planResponse;
    const activeSubscription = subscriptionList.find((sub) =>
      ACTIVE_STRIPE_STATUSES.includes(sub.status)
    );
    if (activeSubscription) {
      return activeSubscription.items[0].price.recurring?.interval || 'month';
    }
  }
  return 'month';
}

/**
 * Extract the limits from Stripe product/price metadata and convert their values from string to number (if necessary.)
 * Will only return limits that exceed the ones in `limitsToCompare`, or all limits if `limitsToCompare` is not present.
 */
function getLimitsForMetadata(
  metadata: PriceMetadata,
  limitsToCompare: false | AccountLimit = false
) {
  const limits: Partial<AccountLimit> = {};
  const quantity = getAdjustedQuantityForPrice(
    parseInt(metadata['quantity']),
    metadata.transform_quantity
  );
  for (const [key, value] of Object.entries(metadata)) {
    // if we need to compare limits, make sure we're not overwriting a higher limit from somewhere else
    if (limitsToCompare) {
      if (!(key in limitsToCompare) || value === null) {
        continue;
      }
      if (
        key in limitsToCompare &&
        value !== Limits.unlimited &&
        value <= limitsToCompare[key as keyof AccountLimit]
      ) {
        continue;
      }
    }
    // only use metadata needed for limit calculations
    if (key in DEFAULT_LIMITS && value !== null) {
      const numericValue = parseInt(value as string);
      limits[key as keyof AccountLimit] =
        value === Limits.unlimited ? Limits.unlimited : numericValue * quantity;
    }
  }
  return limits;
}

/**
 * Get limits for the custom free tier (from `FREE_TIER_THRESHOLDS`), and merges them with the user's limits.
 * The `/environment/` endpoint handles checking whether the logged-in user registered before `FREE_TIER_CUTOFF_DATE`.
 */
const getFreeTierLimits = async (limits: AccountLimit) => {
  await when(() => envStore.isReady);
  const thresholds = envStore.data.free_tier_thresholds;
  const newLimits: AccountLimit = {...limits};
  if (thresholds.storage) {
    newLimits['storage_bytes_limit'] = thresholds.storage;
  }
  if (thresholds.data) {
    newLimits['submission_limit'] = thresholds.data;
  }
  if (thresholds.translation_chars) {
    newLimits['mt_characters_limit'] = thresholds.translation_chars;
  }
  if (thresholds.transcription_minutes) {
    newLimits['asr_seconds_limit'] = thresholds.transcription_minutes * 60;
  }
  return newLimits;
};

/**
 * Get limits for any recurring add-ons the user has, merged with the rest of their limits.
 */
const getRecurringAddOnLimits = (limits: AccountLimit) => {
  let newLimits = {...limits};
  let activeAddOns = [...subscriptionStore.addOnsResponse];
  let metadata: PriceMetadata;
  // only check active add-ons
  activeAddOns = activeAddOns.filter((subscription) =>
    ACTIVE_STRIPE_STATUSES.includes(subscription.status)
  );
  activeAddOns.forEach((addOn) => {
    metadata = {
      ...addOn.items[0].price.product.metadata,
      ...addOn.items[0].price.metadata,
      quantity: activeAddOns[0].quantity.toString(),
      transform_quantity: activeAddOns[0].items[0].price.transform_quantity,
    };
    newLimits = {...newLimits, ...getLimitsForMetadata(metadata, newLimits)};
  });
  return newLimits;
};

/**
 * Add one-time addon limits to already calculated account limits
 */
const addRemainingOneTimeAddOnLimits = (
  limits: AccountLimit,
  oneTimeAddOns: OneTimeAddOn[]
) => {
  // This yields a separate object, so we need to make a copy
  limits = {...limits};
  oneTimeAddOns
    .filter((addon) => addon.is_available)
    .forEach((addon) => {
      if (
        addon.limits_remaining.submission_limit &&
        limits.submission_limit !== Limits.unlimited
      ) {
        limits.submission_limit += addon.limits_remaining.submission_limit;
      }
      if (
        addon.limits_remaining.asr_seconds_limit &&
        limits.asr_seconds_limit !== Limits.unlimited
      ) {
        limits.asr_seconds_limit += addon.limits_remaining.asr_seconds_limit;
      }
      if (
        addon.limits_remaining.mt_characters_limit &&
        limits.mt_characters_limit !== Limits.unlimited
      ) {
        limits.mt_characters_limit +=
          addon.limits_remaining.mt_characters_limit;
      }
    });
  return limits;
};

/**
 * Get all metadata keys for the logged-in user's plan, or from the free tier if they have no plan.
 */
const getStripeMetadataAndFreeTierStatus = async (products: Product[]) => {
  await when(() => subscriptionStore.isInitialised);
  const plans = [...subscriptionStore.planResponse];
  // only use metadata for active subscriptions
  const activeSubscriptions = plans.filter((subscription) =>
    ACTIVE_STRIPE_STATUSES.includes(subscription.status)
  );
  let metadata: PriceMetadata;
  let hasFreeTier = false;
  if (activeSubscriptions.length) {
    // get metadata from the user's subscription (prioritize price metadata over product metadata)
    metadata = {
      ...activeSubscriptions[0].items[0].price.product.metadata,
      ...activeSubscriptions[0].items[0].price.metadata,
      transform_quantity:
        activeSubscriptions[0].items[0].price.transform_quantity,
      quantity: activeSubscriptions[0].quantity.toString(),
    };
  } else {
    await when(() => !!products.length);
    // the user has no subscription, so get limits from the free monthly product
    hasFreeTier = true;
    const freeProduct = products.filter((product) =>
      product.prices.filter(
        (price) =>
          price.unit_amount === 0 && price.recurring?.interval === 'month'
      )
    )[0];
    metadata = {
      ...freeProduct.metadata,
      ...freeProduct.prices[0].metadata,
      transform_quantity: null,
      quantity: '1',
    };
  }
  return {metadata, hasFreeTier};
};

/**
 * Get the complete account limits for the logged-in user.
 * Checks (in descending order of priority):
 *  - the user's recurring add-ons
 *  - the `FREE_TIER_THRESHOLDS` override
 *  - the user's subscription limits
 */
export async function getAccountLimits(
  products: Product[],
  oneTimeAddOns: OneTimeAddOn[]
) {
  const {metadata, hasFreeTier} = await getStripeMetadataAndFreeTierStatus(
    products
  );

  // initialize to unlimited
  let recurringLimits: AccountLimit = {...DEFAULT_LIMITS};

  // apply any limits from the metadata
  recurringLimits = {...recurringLimits, ...getLimitsForMetadata(metadata)};

  if (hasFreeTier) {
    // if the user is on the free tier, overwrite their limits with whatever free tier limits exist
    recurringLimits = await getFreeTierLimits(recurringLimits);

    // if the user has active recurring add-ons, use those as their limits
    recurringLimits = getRecurringAddOnLimits(recurringLimits);
  }

  // create separate object with one-time addon limits added to the limits calculated so far
  const remainingLimits = addRemainingOneTimeAddOnLimits(
    recurringLimits,
    oneTimeAddOns
  );

  return {recurringLimits, remainingLimits};
}
