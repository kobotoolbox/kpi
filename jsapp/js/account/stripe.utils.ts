import {when} from 'mobx';
import prettyBytes from 'pretty-bytes';
import {useCallback} from 'react';

import {ACTIVE_STRIPE_STATUSES} from 'js/constants';
import envStore from 'js/envStore';
import {
  Limits,
  USAGE_TYPE,
  Price,
  BaseProduct,
  ChangePlan,
  Checkout,
  Product,
  SubscriptionChangeType,
  SubscriptionInfo,
  TransformQuantity,
  LimitAmount,
} from 'js/account/stripe.types';
import subscriptionStore from 'js/account/subscriptionStore';
import {convertUnixTimestampToUtc, notify} from 'js/utils';
import {ChangePlanStatus} from 'js/account/stripe.types';

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

export function isOneTimeAddonProduct(product: Product) {
  return product.metadata?.product_type === 'addon_onetime';
}

export function isRecurringAddonProduct(product: Product) {
  return product.metadata?.product_type === 'addon';
}

export function isAddonProduct(product: Product) {
  return isOneTimeAddonProduct(product) || isRecurringAddonProduct(product);
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
  switch (data.status) {
    case ChangePlanStatus.success:
    case ChangePlanStatus.scheduled:
      notify.success(
        t(
          'Success! Your subscription will change at the end of the current billing period.'
        ),
        {
          duration: 10000,
        }
      );
      /**
        Wait a bit for the Stripe webhook to (hopefully) complete and the subscription list to update.
        We do this for 90% of use cases, since we can't tell on the frontend when the webhook has completed.
      */
      await new Promise((resolve) => setTimeout(resolve, 3000));
      window.location.reload();
      break;
    default:
      break;
  }
  return data.status;
}

/**
 * Check if any of a list of subscriptions are scheduled to change to a given price at some point.
 */
export function isChangeScheduled(
  price: Price,
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

/*
 * Performs logical operations to determine what information to provide about
 * the upcoming status of user's subscription.
 */
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
        if (nextProduct.id === currentPlan.items[0].price.product.id) {
          if (currentPlan.quantity !== nextPhaseItem.quantity) {
            type = SubscriptionChangeType.QUANTITY_CHANGE;
          } else {
            type = SubscriptionChangeType.PRICE_CHANGE;
          }
        } else {
          type = SubscriptionChangeType.PRODUCT_CHANGE;
        }
        break;
      }
    }
  } else if (currentPlan && type === SubscriptionChangeType.NO_CHANGE) {
    date = currentPlan.current_period_end;
    type = SubscriptionChangeType.RENEWAL;
  }
  return {nextProduct, date, type};
};

/**
 * Takes a Stripe quantity (representing a total number of submissions included with a plan)
 * and returns the transformed quantity. The total price of the transaction can be
 * found by (transformed quantity x price unit amount).
 * @param baseQuantity - the `quantity` field of the subscription in Stripe (total submission limit)
 * @param transform - the `transform_quantity` field of the price
 */
export const getAdjustedQuantityForPrice = (
  baseQuantity: number,
  transform: TransformQuantity | null
) => {
  let adjustedQuantity = baseQuantity;
  if (transform?.divide_by) {
    adjustedQuantity /= transform.divide_by;
  }
  if (transform?.round === 'up') {
    adjustedQuantity = Math.ceil(adjustedQuantity);
  }
  if (transform?.round === 'down') {
    adjustedQuantity = Math.floor(adjustedQuantity);
  }
  return adjustedQuantity;
};

/**
 * Tests whether a new price/quantity would cost less than the user's current subscription.
 */
export const isDowngrade = (
  currentSubscriptions: SubscriptionInfo[],
  price: Price,
  newQuantity: number
) => {
  if (!currentSubscriptions.length) {
    return false;
  }
  const subscriptionItem = currentSubscriptions[0].items[0];
  const currentTotalPrice =
    subscriptionItem.price.unit_amount *
    getAdjustedQuantityForPrice(
      subscriptionItem.quantity,
      subscriptionItem.price.transform_quantity
    );
  const newTotalPrice =
    price.unit_amount *
    getAdjustedQuantityForPrice(newQuantity, price.transform_quantity);
  return currentTotalPrice > newTotalPrice;
};

/**
 * Render a limit amount, usage amount, or total balance as readable text
 * @param {USAGE_TYPE} type - The limit/usage amount
 * @param {number|'unlimited'} amount - The limit/usage amount
 * @param {number|'unlimited'|null} [available=null] - If we're showing a balance,
 * `amount` takes the usage amount and this takes the limit amount
 */
export const useLimitDisplay = () => {
  const limitDisplay = useCallback(
    (
      type: USAGE_TYPE,
      amount: LimitAmount,
      available: LimitAmount | null = null
    ) => {
      if (amount === Limits.unlimited || available === Limits.unlimited) {
        return t('Unlimited');
      }
      const total = available ? available - amount : amount;
      switch (type) {
        case USAGE_TYPE.STORAGE:
          return prettyBytes(total);
        case USAGE_TYPE.TRANSCRIPTION:
          return t('##minutes## mins').replace(
            '##minutes##',
            typeof total === 'number'
              ? Math.floor(total).toLocaleString()
              : total
          );
        default:
          return total.toLocaleString();
      }
    },
    []
  );
  return {limitDisplay};
};
