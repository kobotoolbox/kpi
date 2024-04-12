import React, {useCallback, useEffect, useMemo, useState} from 'react';
import useWhen from 'js/hooks/useWhen.hook';
import subscriptionStore from 'js/account/subscriptionStore';
import {
  Price,
  Organization,
  Product,
  SubscriptionInfo,
} from 'js/account/stripe.types';
import {
  getSubscriptionChangeDetails,
  isAddonProduct,
  isChangeScheduled,
  isOneTimeAddonProduct,
  isRecurringAddonProduct,
  processCheckoutResponse,
} from 'js/account/stripe.utils';
import {postCustomerPortal} from 'js/account/stripe.api';
import styles from './addOnList.module.scss';
import BillingButton from 'js/account/plans/billingButton.component';
import {OneTimeAddOnRow} from 'js/account/add-ons/oneTimeAddOnRow.component';
import {UpdateBadge} from 'js/account/add-ons/updateBadge.component.';

/**
 * A table of add-on products along with buttons to purchase/manage them.
 */
const AddOnList = (props: {
  products: Product[];
  organization: Organization | null;
  isBusy: boolean;
  setIsBusy: (value: boolean) => void;
  onClickBuy: (price: Price) => void;
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
      .filter((product) => isAddonProduct(product))
      .map((product) => {
        return {
          ...product,
          prices: product.prices.filter((price) => price.active),
        };
      });
    setAddOnProducts(addonProducts);
  }, [props.products]);

  const currentAddon = useMemo(() => {
    if (subscriptionStore.addOnsResponse.length) {
      return subscriptionStore.addOnsResponse[0];
    } else {
      return null;
    }
  }, [subscriptionStore.isInitialised]);

  const subscriptionUpdate = useMemo(() => {
    return getSubscriptionChangeDetails(currentAddon, props.products);
  }, [currentAddon, props.products]);

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
    (price: Price) =>
      isChangeScheduled(price, activeSubscriptions) ||
      subscribedAddOns.some(
        (subscription) => subscription.items[0].price.id === price.id
      ),
    [subscribedAddOns]
  );

  const handleCheckoutError = () => {
    props.setIsBusy(false);
  };

  const onClickManage = (price?: Price) => {
    if (!props.organization || props.isBusy) {
      return;
    }
    props.setIsBusy(true);
    postCustomerPortal(props.organization.id, price?.id)
      .then(processCheckoutResponse)
      .catch(handleCheckoutError);
  };

  if (!addOnProducts.length || !props.organization) {
    return null;
  }

  return (
    <table className={styles.table}>
      <caption className={styles.caption}>
        <label className={styles.header}>{t('available add-ons')}</label>
        <p>
          {t(
            `Add-ons can be added to your Community plan to increase your usage limits. If you are approaching or
            have reached the usage limits included with your plan, increase your limits with add-ons to continue
            data collection.`
          )}
        </p>
      </caption>
      <tbody>
        {addOnProducts.map((product) => {
          if (isOneTimeAddonProduct(product) && props.organization) {
            return (
              <OneTimeAddOnRow
                key={product.id}
                product={product}
                isDisabled={props.isBusy}
                organization={props.organization}
              />
            );
          }
          return product.prices.map((price) => (
            <tr className={styles.row} key={price.id}>
              <td className={styles.product}>
                <span className={styles.productName}>{product.name}</span>
                {subscriptionUpdate && isSubscribedAddOnPrice(price) && (
                  <UpdateBadge
                    price={price}
                    subscriptionUpdate={subscriptionUpdate}
                    currentAddon={currentAddon}
                  />
                )}
              </td>
              <td className={styles.price}>{price.human_readable_price}</td>
              <td>
                {isSubscribedAddOnPrice(price) && (
                  <BillingButton
                    size={'m'}
                    label={t('Manage')}
                    isDisabled={props.isBusy}
                    onClick={onClickManage}
                    isFullWidth
                  />
                )}
                {!isSubscribedAddOnPrice(price) && (
                  <BillingButton
                    size={'m'}
                    label={t('Buy now')}
                    isDisabled={props.isBusy}
                    onClick={() => props.onClickBuy(price)}
                    isFullWidth
                  />
                )}
              </td>
            </tr>
          ));
        })}
      </tbody>
    </table>
  );
};

export default AddOnList;
