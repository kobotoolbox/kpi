import BillingButton from 'js/account/plans/billingButton.component';
import React, {useContext} from 'react';
import type {
  Price,
  Organization,
  SinglePricedProduct,
} from 'js/account/stripe.types';
import {postCustomerPortal} from 'js/account/stripe.api';
import {processCheckoutResponse} from 'js/account/stripe.utils';
import {OrganizationContext} from 'js/account/organizations/useOrganization.hook';

interface PlanButtonProps {
  buySubscription: (price: Price, quantity?: number) => void;
  downgrading: boolean;
  isBusy: boolean;
  isSubscribedToPlan: boolean;
  showManage: boolean;
  product: SinglePricedProduct;
  quantity: number;
  setIsBusy: (value: boolean) => void;
}

/**
 * A button that's used to start checkout for a Plan at Stripe.
 * Plans need extra logic that add-ons don't, mostly to display the correct label text.
 */
export const PlanButton = ({
  product,
  downgrading,
  isBusy,
  setIsBusy,
  buySubscription,
  showManage,
  quantity,
  isSubscribedToPlan,
}: PlanButtonProps) => {
  const [organization] = useContext(OrganizationContext);

  if (!product || !organization || product.price.unit_amount === 0) {
    return null;
  }

  const manageSubscription = (subscriptionPrice?: Price) => {
    setIsBusy(true);
    postCustomerPortal(organization.id, subscriptionPrice?.id, quantity)
      .then(processCheckoutResponse)
      .catch(() => setIsBusy(false));
  };

  if (!isSubscribedToPlan && !showManage && !downgrading) {
    return (
      <BillingButton
        label={t('Upgrade')}
        onClick={() => buySubscription(product.price, quantity)}
        aria-label={`upgrade to ${product.name}`}
        isDisabled={isBusy}
      />
    );
  }

  if (showManage || isSubscribedToPlan) {
    return (
      <BillingButton
        label={t('Manage')}
        onClick={manageSubscription}
        aria-label={`manage your ${product.name} subscription`}
        isDisabled={isBusy}
      />
    );
  }

  return (
    <BillingButton
      label={t('Change plan')}
      onClick={() => buySubscription(product.price, quantity)}
      aria-label={`change your subscription to ${product.name}`}
      isDisabled={isBusy}
    />
  );
};
