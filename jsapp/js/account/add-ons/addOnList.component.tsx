import React, {useCallback, useEffect, useMemo, useState} from 'react';
import useWhen from 'js/hooks/useWhen.hook';
import subscriptionStore from 'js/account/subscriptionStore';
import {
  Price,
  Organization,
  Product,
  SubscriptionChangeType,
  SubscriptionInfo,
} from 'js/account/stripe.types';
import {
  getSubscriptionChangeDetails,
  isAddonProduct,
  isChangeScheduled,
  isRecurringAddonProduct,
  processCheckoutResponse,
} from 'js/account/stripe.utils';
import {formatDate} from 'js/utils';
import {postCustomerPortal} from 'js/account/stripe.api';
import styles from './addOnList.module.scss';
import BillingButton from 'js/account/plans/billingButton.component';
import Badge, {BadgeColor} from 'js/components/common/badge';

/**
 * A table of add-on products along with buttons to purchase/manage them.
 * @TODO Until one-time add-ons are complete, this only displays recurring add-ons.
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
      .filter(isAddonProduct)
      // TODO: remove the next line when one-time add-ons are ready
      .filter(isRecurringAddonProduct)
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

  const renderUpdateBadge = (price: Price) => {
    if (!(subscriptionUpdate && isSubscribedAddOnPrice(price))) {
      return null;
    }

    let color: BadgeColor;
    let label;
    switch (subscriptionUpdate.type) {
      case SubscriptionChangeType.CANCELLATION:
        color = 'light-red';
        label = t('Ends on ##cancel_date##').replace(
          '##cancel_date##',
          formatDate(subscriptionUpdate.date)
        );
        break;
      case SubscriptionChangeType.RENEWAL:
        color = 'light-blue';
        label = t('Renews on ##renewal_date##').replace(
          '##renewal_date##',
          formatDate(subscriptionUpdate.date)
        );
        break;
      case SubscriptionChangeType.PRODUCT_CHANGE:
        if (currentAddon?.items[0].price.product.id === price.product) {
          color = 'light-amber';
          label = t('Ends on ##end_date##').replace(
            '##end_date##',
            formatDate(subscriptionUpdate.date)
          );
        } else {
          color = 'light-teal';
          label = t('Starts on ##start_date##').replace(
            '##start_date##',
            formatDate(subscriptionUpdate.date)
          );
        }
        break;
      default:
        return null;
    }
    return <Badge size={'s'} color={color} label={label} />;
  };

  if (!addOnProducts.length || subscribedPlans.length || !props.organization) {
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
        {addOnProducts.map((product) =>
          product.prices.map((price) => (
            <tr className={styles.row} key={price.id}>
              <td className={styles.product}>
                <span className={styles.productName}>{product.name}</span>
                {renderUpdateBadge(price)}
              </td>
              <td className={styles.price}>{price.human_readable_price}</td>
              <td>
                <div className={styles.product}>{product.name}</div>
                <div className={styles.price}>{price.human_readable_price}</div>
              </td>
              <td className={styles.buy}>
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
          ))
        )}
      </tbody>
    </table>
  );
};

export default AddOnList;
