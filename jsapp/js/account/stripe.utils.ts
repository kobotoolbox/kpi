import {when} from 'mobx';

import {ACTIVE_STRIPE_STATUSES} from 'js/constants';
import envStore from 'js/envStore';
import subscriptionStore from 'js/account/subscriptionStore';
import type {Product} from 'js/account/stripe.api';
import {notify} from 'js/utils';

// check if the currently logged-in user has a paid subscription in an active status
// promise returns a boolean, or `null` if Stripe is not active - we check for the existence of `stripe_public_key`
export async function hasActiveSubscription() {
  await when(() => envStore.isReady);
  if (!envStore.data.stripe_public_key) {
    return null;
  }

  if (!subscriptionStore.isPending && !subscriptionStore.isInitialised) {
    subscriptionStore.fetchSubscriptionInfo();
  }

  await when(() => subscriptionStore.isInitialised);
  const plans = subscriptionStore.planResponse;
  if (!plans.length) {
    return false;
  }

  return (
    plans.filter(
      (sub) =>
        ACTIVE_STRIPE_STATUSES.includes(sub.status) &&
        sub.items?.[0].price.unit_amount > 0
    ).length > 0
  );
}

export function isAddonProduct(product: Product) {
  return product.metadata.product_type === 'addon';
}

export function isRecurringAddonProduct(product: Product) {
  return product.prices.some((price) => price?.recurring);
}

export function processCheckoutResponse(data: {url: string}) {
  if (!data?.url) {
    notify.error(t('There has been an issue, please try again later.'));
  } else {
    window.location.assign(data.url);
  }
}
