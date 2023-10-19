import React, {useCallback, useEffect, useState} from 'react';
import useWhen from 'js/hooks/useWhen.hook';
import type {SubscriptionInfo} from 'js/account/subscriptionStore';
import subscriptionStore from 'js/account/subscriptionStore';
import type {BasePrice, Organization, Product} from 'js/account/stripe.api';
import Button from 'js/components/common/button';
import {
  isAddonProduct,
  isChangeScheduled,
  isRecurringAddonProduct,
  processChangePlanResponse,
  processCheckoutResponse,
} from 'js/account/stripe.utils';
import {
  changeSubscription,
  postCheckout,
  postCustomerPortal,
} from 'js/account/stripe.api';

const AddOnList = (props: {
  products: Product[] | null;
  organization: Organization | null;
}) => {
  const [subscribedAddOns, setSubscribedAddOns] = useState<SubscriptionInfo[]>(
    []
  );
  const [subscribedPlans, setSubscribedPlans] = useState<SubscriptionInfo[]>(
    []
  );
  const [activeSubscriptions, setActiveSubscriptions] = useState<
    SubscriptionInfo[]
  >([]);
  const [addOnProducts, setAddOnProducts] = useState<Product[]>([]);

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
      setSubscribedPlans(subscriptionStore.planResponse);
      setActiveSubscriptions(subscriptionStore.activeSubscriptions);
    },
    []
  );

  const isSubscribedAddOnPrice = useCallback(
    (price) =>
      isChangeScheduled(price, activeSubscriptions) ||
      subscribedAddOns.some(
        (subscription) => subscription.items[0].price.id === price.id
      ),
    [subscribedAddOns]
  );

  const purchaseAddOn = (price: BasePrice) => {
    if (!props.organization) {
      return;
    }
    if (activeSubscriptions.length) {
      changeSubscription(price.id, activeSubscriptions[0].id)
        .then(processChangePlanResponse)
        .catch((err) => console.log(err));
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

  if (!addOnProducts || subscribedPlans || !props.organization) {
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

export default AddOnList;
