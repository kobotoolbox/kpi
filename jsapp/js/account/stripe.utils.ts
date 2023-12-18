import {when} from 'mobx';

import {ACTIVE_STRIPE_STATUSES} from 'js/constants';
import envStore from 'js/envStore';
import type {
  BasePrice,
  ChangePlan,
  Checkout,
  Product,
  SubscriptionInfo,
} from 'js/account/stripe.types';
import subscriptionStore from 'js/account/subscriptionStore';
import {notify} from 'js/utils';
import {ChangePlanStatus} from 'js/account/stripe.types';
import {ACCOUNT_ROUTES} from 'js/account/routes';

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

export function processCheckoutResponse(data: Checkout) {
  if (!data?.url) {
    notify.error(t('There has been an issue, please try again later.'), {
      duration: 10000,
    });
  } else {
    window.location.assign(data.url);
  }
}

export async function processChangePlanResponse(data: ChangePlan) {
  /**
    Wait a bit for the Stripe webhook to (hopefully) complete and the subscription list to update.
    We do this for 90% of use cases, since we can't tell on the frontend when the webhook has completed.
    The other 10% will be directed to refresh the page if the subscription isn't updated in the UI.
   */
  await new Promise((resolve) => setTimeout(resolve, 2000));
  switch (data.status) {
    case ChangePlanStatus.success:
      processCheckoutResponse(data);
      location.hash = '';
      location.hash = ACCOUNT_ROUTES.PLAN;
      break;
    case ChangePlanStatus.scheduled:
      location.hash = '';
      location.hash = ACCOUNT_ROUTES.PLAN;
      notify.success(
        t(
          'Success! Your subscription will change at the end of the current billing period.'
        ),
        {
          duration: 10000,
        }
      );
      break;
    default:
      notify.error(
        t(
          'There was an error processing your plan change. Your previous plan has not been changed. Please try again later.'
        ),
        {
          duration: 10000,
        }
      );
      break;
  }
  return data.status;
}

/**
 * Check if any of a list of subscriptions are scheduled to change to a given price at some point.
 */
export function isChangeScheduled(
  price: BasePrice,
  subscriptions: SubscriptionInfo[] | null
) {
  return (
    !subscriptions ||
    subscriptions.some((subscription) =>
      subscription.schedule?.phases?.some((phase) =>
        phase.items.some((item) => item.price === price.id)
      )
    )
  );
}

export const getSubscriptionsForProductId = (
  productId: String,
  subscriptions: SubscriptionInfo[] | null
) => {
  if (subscriptions) {
    return subscriptions.filter(
      (subscription: SubscriptionInfo) =>
        subscription.items[0].price.product.id === productId
    );
  }
  return null;
};
