import {when} from 'mobx';

import {ACTIVE_STRIPE_STATUSES} from 'js/constants';
import envStore from 'js/envStore';
import {
  BasePrice,
  BaseProduct,
  ChangePlan,
  Checkout,
  Product,
  SubscriptionChangeType,
  SubscriptionInfo,
} from 'js/account/stripe.types';
import subscriptionStore from 'js/account/subscriptionStore';
import {convertUnixTimestampToUtc, notify} from 'js/utils';
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

export const getSubscriptionChangeDetails = (
  currentPlan: SubscriptionInfo | null,
  products: Product[]
) => {
  if (!(currentPlan && products.length)) {
    return null;
  }
  let nextProduct: BaseProduct | null = null;
  let date = '';
  let type: SubscriptionChangeType = SubscriptionChangeType.NO_CHANGE;
  if (currentPlan.cancel_at) {
    date = currentPlan.cancel_at;
    type = SubscriptionChangeType.CANCELLATION;
  } else if (
    currentPlan.schedule &&
    currentPlan.schedule.status === 'active' &&
    currentPlan.schedule.phases?.length &&
    currentPlan.schedule.phases.length > 1
  ) {
    let nextPhaseItem = currentPlan.schedule.phases[1].items[0];
    for (const product of products) {
      let price = product.prices.find(
        (price) => price.id === nextPhaseItem.price
      );
      if (price) {
        nextProduct = product;
        date = convertUnixTimestampToUtc(
          currentPlan.schedule.phases[0].end_date!
        );
        type =
          nextProduct.id === currentPlan.items[0].price.product.id
            ? SubscriptionChangeType.PRICE_CHANGE
            : SubscriptionChangeType.PRODUCT_CHANGE;
        break;
      }
    }
  } else if (currentPlan && type === SubscriptionChangeType.NO_CHANGE) {
    date = currentPlan.current_period_end;
    type = SubscriptionChangeType.RENEWAL;
  }
  return {nextProduct, date, type};
};
