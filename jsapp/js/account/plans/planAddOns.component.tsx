import React, {useCallback, useEffect, useState} from 'react';
import useWhen from 'js/hooks/useWhen.hook';
import type {SubscriptionInfo} from 'js/account/subscriptionStore';
import subscriptionStore from 'js/account/subscriptionStore';
import type {BasePrice, Organization, Product} from 'js/account/stripe.api';
import Button from 'js/components/common/button';
import {
  isAddonProduct,
  isRecurringAddonProduct,
  processCheckoutResponse,
} from 'js/account/stripe.utils';
import {postCheckout, postCustomerPortal} from 'js/account/stripe.api';
import {navigate} from '@storybook/addon-links';

const PlanAddOns = (props: {
  products: Product[] | null;
  organization: Organization | null;
}) => {
  const [subscribedAddOns, setSubscribedAddOns] = useState<SubscriptionInfo[]>(
    []
  );
  const [addOnProducts, setAddOnProducts] = useState<Product[]>([]);
  const [hasSubscription, setHasSubscription] = useState(false);

  /**
   * Extract the add-on products and prices from the list of all products
   */
  useEffect(() => {
    if (!props.products) {
      return;
    }
    const addonProducts = props.products
      .filter(isAddonProduct)
      // TODO: remove the next line when one-time add-ons are ready
      .filter(isRecurringAddonProduct);
    setAddOnProducts(addonProducts);
  }, [props.products]);

  useWhen(
    () => subscriptionStore.isInitialised,
    () => {
      setSubscribedAddOns(subscriptionStore.addOnsResponse);
      setHasSubscription(
        subscriptionStore.addOnsResponse.length > 0 ||
          subscriptionStore.planResponse.length > 0
      );
    },
    []
  );

  const isSubscribedAddOnPrice = useCallback(
    (price) =>
      subscribedAddOns.some(
        (subscription) => subscription.plan.id === price.id
      ),
    [subscribedAddOns]
  );

  const purchaseAddOn = (price: BasePrice) => {
    if (!props.organization) {
      return;
    }
    if (hasSubscription) {
      // TODO: change plans
    } else {
      postCheckout(price.id, props.organization.id).then(
        processCheckoutResponse
      );
    }
  };

  const manageAddOn = () => {
    if (!props.organization) {
      return;
    }
    postCustomerPortal(props.organization.id).then(processCheckoutResponse);
  };

  if (!addOnProducts || !props.products || !props.organization) {
    return null;
  }

  return (
    <table>
      <caption>
        <h2>{t('available add-ons')}</h2>
      </caption>
      <tbody>
        {addOnProducts.map((product) =>
          product.prices.map((price) => (
            <tr key={price.id}>
              <td>{product.name}</td>
              <td>{price.human_readable_price}</td>
              <td>
                {isSubscribedAddOnPrice(price) && (
                  <Button
                    color={'blue'}
                    type={'full'}
                    size={'m'}
                    label={t('manage subscription')}
                    onClick={manageAddOn}
                  />
                )}
                {!isSubscribedAddOnPrice(price) && (
                  <Button
                    color={'blue'}
                    type={'full'}
                    size={'m'}
                    label={t('buy now')}
                    onClick={() => purchaseAddOn(price)}
                  />
                )}
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
};

export default PlanAddOns;
