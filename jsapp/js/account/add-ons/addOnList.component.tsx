import React, {useContext, useEffect, useState} from 'react';
import useWhen from 'js/hooks/useWhen.hook';
import subscriptionStore from 'js/account/subscriptionStore';
import type {
  Price,
  Organization,
  Product,
  SubscriptionInfo,
  OneTimeAddOn,
} from 'js/account/stripe.types';
import {isAddonProduct} from 'js/account/stripe.utils';
import styles from './addOnList.module.scss';
import {OneTimeAddOnRow} from 'js/account/add-ons/oneTimeAddOnRow.component';
import Badge from 'jsapp/js/components/common/badge';
import {formatDate} from 'js/utils';
import {OneTimeAddOnsContext} from 'jsapp/js/account/useOneTimeAddonList.hook';

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
  const [addOnProducts, setAddOnProducts] = useState<Product[]>([]);
  const oneTimeAddOnsContext = useContext(OneTimeAddOnsContext);
  const oneTimeAddOnSubscriptions = oneTimeAddOnsContext.oneTimeAddOns;
  const oneTimeAddOneProducts = addOnProducts.filter(
    (product) => product.metadata.product_type === 'addon_onetime'
  );
  const filteredAddOnProducts = addOnProducts.filter(
    (product) => product.metadata.product_type === 'addon'
  );

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

  useWhen(
    () => subscriptionStore.isInitialised,
    () => {
      setSubscribedAddOns(subscriptionStore.addOnsResponse);
      setSubscribedPlans(subscriptionStore.planResponse);
    },
    []
  );

  if (!addOnProducts.length || !props.organization) {
    return null;
  }

  return (
    <>
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
          {props.organization && (
            <>
              {!subscribedPlans.length && (
                <OneTimeAddOnRow
                  key={filteredAddOnProducts
                    .map((product) => product.id)
                    .join('-')}
                  products={filteredAddOnProducts}
                  isDisabled={props.isBusy}
                  organization={props.organization}
                />
              )}
              <OneTimeAddOnRow
                key={oneTimeAddOneProducts
                  .map((product) => product.id)
                  .join('-')}
                products={oneTimeAddOneProducts}
                isDisabled={props.isBusy}
                organization={props.organization}
              />
            </>
          )}
        </tbody>
      </table>
      {subscribedAddOns.some((product) => product.status === 'active') ||
      oneTimeAddOnSubscriptions.some(
        (oneTimeAddOns) => oneTimeAddOns.is_available
      ) ? (
        <table className={styles.table}>
          <caption className={`${styles.caption} ${styles.purchasedAddOns}`}>
            <label className={styles.header}>{t('your active add-ons')}</label>
          </caption>
          <tbody>
            {subscribedAddOns.map((product) => {
              if (product.status === 'active') {
                return (
                  <tr className={styles.row} key={product.id}>
                    <td className={styles.product}>
                      <span className={styles.productName}>
                        {product.items[0].price.product.name}
                      </span>
                      <Badge color={'light-teal'} size={'s'} label={'Active'} />
                      <p className={styles.description}>
                        {`Added on ${formatDate(product.created)}`}
                      </p>
                    </td>
                    <td className={styles.activePrice}>
                      {product.items[0].price.human_readable_price
                        .replace('USD/month', '')
                        .replace('USD/year', '')}
                    </td>
                  </tr>
                );
              }
              return null;
            })}
            {oneTimeAddOnSubscriptions.map((oneTimeAddOns: OneTimeAddOn) => {
              if (oneTimeAddOns.is_available) {
                return (
                  <tr className={styles.row} key={oneTimeAddOns.id}>
                    <td className={styles.product}>
                      <span className={styles.productName}>
                        {oneTimeAddOneProducts[0].name +
                          ' x ' +
                          oneTimeAddOns.quantity}
                      </span>
                      <Badge color={'light-teal'} size={'s'} label={'Active'} />
                      <p className={styles.description}>
                        {`Added on ${formatDate(oneTimeAddOns.created)}`}
                      </p>
                    </td>
                    <td className={styles.activePrice}>
                      {new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: 'USD',
                      }).format(
                        (oneTimeAddOns.quantity *
                          oneTimeAddOneProducts[0].prices[0].unit_amount) /
                          100
                      )}
                    </td>
                  </tr>
                );
              }
              return null;
            })}
          </tbody>
        </table>
      ) : null}
      {subscribedAddOns.some((product) => product.status !== 'active') ||
      oneTimeAddOnSubscriptions.some(
        (oneTimeAddOns) => !oneTimeAddOns.is_available
      ) ? (
        <table className={styles.table}>
          <caption className={`${styles.caption} ${styles.purchasedAddOns}`}>
            <label className={styles.header}>{t('previous add-ons')}</label>
          </caption>
          <tbody>
            {subscribedAddOns.map((product) => {
              if (product.status !== 'active') {
                return (
                  <tr className={styles.row} key={product.id}>
                    <td className={styles.product}>
                      <span className={styles.productName}>
                        {product.items[0].price.product.name}
                      </span>
                      <Badge color={'cloud'} size={'s'} label={'inactive'} />
                      <p className={styles.description}>
                        {`Added on ${formatDate(product.created)}`}
                      </p>
                    </td>
                    <td className={styles.activePrice}>
                      {product.items[0].price.human_readable_price
                        .replace('USD/month', '')
                        .replace('USD/year', '')}
                    </td>
                  </tr>
                );
              }
              return null;
            })}
            {oneTimeAddOnSubscriptions.map((oneTimeAddOns: OneTimeAddOn) => {
              if (!oneTimeAddOns.is_available) {
                return (
                  <tr className={styles.row} key={oneTimeAddOns.id}>
                    <td className={styles.product}>
                      <span className={styles.productName}>
                        {oneTimeAddOneProducts[0].name}
                      </span>
                      <Badge color={'cloud'} size={'s'} label={'Inactive'} />
                      <p className={styles.description}>
                        {`Added on ${formatDate(oneTimeAddOns.created)}`}
                      </p>
                    </td>
                    <td className={styles.activePrice}>
                      {new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: 'USD',
                      }).format(
                        (oneTimeAddOns.quantity *
                          oneTimeAddOneProducts[0].prices[0].unit_amount) /
                          100
                      )}
                    </td>
                  </tr>
                );
              }
              return null;
            })}
          </tbody>
        </table>
      ) : null}
    </>
  );
};

export default AddOnList;
