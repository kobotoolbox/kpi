import BillingButton from 'js/account/plans/billingButton.component';
import React, {useCallback} from 'react';
import styles from 'js/account/plans/plan.module.scss';
import {
  BasePrice,
  Organization,
  Price,
  SubscriptionInfo,
} from 'js/account/stripe.types';
import {postCustomerPortal} from 'js/account/stripe.api';
import {
  getSubscriptionsForProductId,
  processCheckoutResponse,
} from 'js/account/stripe.utils';

interface PlanButtonProps {
  price: Price;
  isBusy: boolean;
  plans: SubscriptionInfo[] | null;
  setIsBusy: (value: boolean) => void;
  hasManageableStatus: (subscription: SubscriptionInfo) => boolean;
  isSubscribedProduct: (product: Price) => boolean;
  buySubscription: (price: BasePrice) => void;
  organization?: Organization | null;
}

export const PlanButton = ({
  price,
  organization,
  plans,
  isBusy,
  setIsBusy,
  buySubscription,
  hasManageableStatus,
  isSubscribedProduct,
}: PlanButtonProps) => {
  const shouldShowManage = useCallback(
    (product: Price) => {
      const subscriptions = getSubscriptionsForProductId(product.id, plans);
      if (!subscriptions || !subscriptions.length) {
        return false;
      }

      return subscriptions.some((subscription: SubscriptionInfo) =>
        hasManageableStatus(subscription)
      );
    },
    [hasManageableStatus]
  );

  if (!price || !organization) {
    return null;
  }

  const manageSubscription = (price?: BasePrice) => {
    setIsBusy(true);
    postCustomerPortal(organization.id, price?.id)
      .then(processCheckoutResponse)
      .catch(() => setIsBusy(false));
  };

  if (price.prices.unit_amount === 0) {
    return <div className={styles.btnSpacePlaceholder} />;
  }

  if (!isSubscribedProduct(price) && !shouldShowManage(price)) {
    return (
      <BillingButton
        label={t('Upgrade')}
        onClick={() => buySubscription(price.prices)}
        aria-label={`upgrade to ${price.name}`}
        aria-disabled={isBusy}
        isDisabled={isBusy}
      />
    );
  }

  if (isSubscribedProduct(price) || shouldShowManage(price)) {
    return (
      <BillingButton
        label={t('Manage')}
        onClick={manageSubscription}
        aria-label={`manage your ${price.name} subscription`}
        aria-disabled={isBusy}
        isDisabled={isBusy}
      />
    );
  }

  return (
    <BillingButton
      label={t('Change plan')}
      onClick={() => buySubscription(price.prices)}
      aria-label={`change your subscription to ${price.name}`}
      aria-disabled={isBusy}
      isDisabled={isBusy}
    />
  );
};
