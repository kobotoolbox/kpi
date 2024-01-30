import BillingButton from 'js/account/plans/billingButton.component';
import React from 'react';
import type {BasePrice, Organization, Price} from 'js/account/stripe.types';
import {postCustomerPortal} from 'js/account/stripe.api';
import {processCheckoutResponse} from 'js/account/stripe.utils';

interface PlanButtonProps {
  buySubscription: (price: BasePrice) => void;
  downgrading: boolean;
  isBusy: boolean;
  isSubscribedToPlan: boolean;
  showManage: boolean;
  organization?: Organization | null;
  price: Price;
  setIsBusy: (value: boolean) => void;
}

/**
 * A button that's used to start checkout for a Plan at Stripe.
 * Plans need extra logic that add-ons don't, mostly to display the correct label text.
 */
export const PlanButton = ({
  price,
  organization,
  downgrading,
  isBusy,
  setIsBusy,
  buySubscription,
  showManage,
  isSubscribedToPlan,
}: PlanButtonProps) => {
  if (!price || !organization || price.prices.unit_amount === 0) {
    return null;
  }

  const manageSubscription = (subscriptionPrice?: BasePrice) => {
    setIsBusy(true);
    postCustomerPortal(organization.id, subscriptionPrice?.id)
      .then(processCheckoutResponse)
      .catch(() => setIsBusy(false));
  };

  if (!isSubscribedToPlan && !showManage && !downgrading) {
    return (
      <BillingButton
        label={t('Upgrade')}
        onClick={() => buySubscription(price.prices)}
        aria-label={`upgrade to ${price.name}`}
        isDisabled={isBusy}
      />
    );
  }

  if (showManage || isSubscribedToPlan) {
    return (
      <BillingButton
        label={t('Manage')}
        onClick={manageSubscription}
        aria-label={`manage your ${price.name} subscription`}
        isDisabled={isBusy}
      />
    );
  }

  return (
    <BillingButton
      label={t('Change plan')}
      onClick={() => buySubscription(price.prices)}
      aria-label={`change your subscription to ${price.name}`}
      isDisabled={isBusy}
    />
  );
};
