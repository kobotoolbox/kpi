import {when} from 'mobx';

import {ACTIVE_STRIPE_STATUSES} from 'js/constants';
import envStore from 'js/envStore';
import subscriptionStore from 'js/account/subscriptionStore';

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
