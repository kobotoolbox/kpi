import {
  getSubscription,
} from 'js/account/stripe.api';
import envStore from 'js/envStore';
import {when} from "mobx";

// check if the currently logged-in user has a paid subscription in an active status
// promise returns a boolean, or `null` if Stripe is not active - we check for the existence of `stripe_public_key`
export async function hasActiveSubscription() {
  const subscription = await getSubscription();
  if (!subscription?.count) {
    return false;
  }
  await when(() => envStore.isReady);
  if (!envStore.data.stripe_public_key) {
    return null;
  }
  //activeStatuses = envStore.data.active_stripe_statuses;
  const activeStatuses = ['active', 'past_due', 'trialing'];
  return subscription.results.filter(subscription => activeStatuses.includes(subscription.status)).length > 0;
}
