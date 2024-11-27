import styles from 'js/account/addOns/addOnList.module.scss';
import React, {useMemo, useState} from 'react';
import type {
  Product,
  SubscriptionInfo,
} from 'js/account/stripe.types';
import KoboSelect3 from 'js/components/special/koboAccessibleSelect';
import BillingButton from 'js/account/plans/billingButton.component';
import {postCheckout, postCustomerPortal} from 'js/account/stripe.api';
import {useDisplayPrice} from 'js/account/plans/useDisplayPrice.hook';
import {isChangeScheduled} from 'js/account/stripe.utils';
import type {Organization} from 'js/account/organization/organizationQuery';

interface OneTimeAddOnRowProps {
  products: Product[];
  isBusy: boolean;
  setIsBusy: (value: boolean) => void;
  activeSubscriptions: SubscriptionInfo[];
  subscribedAddOns: SubscriptionInfo[];
  organization: Organization;
}

const MAX_ONE_TIME_ADDON_PURCHASE_QUANTITY = 10;

const quantityOptions = Array.from(
  {length: MAX_ONE_TIME_ADDON_PURCHASE_QUANTITY},
  (_, zeroBasedIndex) => {
    const index = (zeroBasedIndex + 1).toString();
    return {value: index, label: index};
  }
);

export const OneTimeAddOnRow = ({
  products,
  isBusy,
  setIsBusy,
  activeSubscriptions,
  subscribedAddOns,
  organization,
}: OneTimeAddOnRowProps) => {
  const [selectedProduct, setSelectedProduct] = useState(products[0]);
  const [quantity, setQuantity] = useState('1');
  const [selectedPrice, setSelectedPrice] = useState<Product['prices'][0]>(
    selectedProduct.prices[0]
  );
  const displayPrice = useDisplayPrice(selectedPrice, parseInt(quantity));
  const priceOptions = useMemo(
    () =>
      selectedProduct.prices.map((price) => {
        return {value: price.id, label: price.recurring?.interval || 'me'};
      }),
    [selectedProduct]
  );

  let displayName;
  let description;

  if (
    selectedProduct.metadata.asr_seconds_limit ||
    selectedProduct.metadata.mt_characters_limit
  ) {
    displayName = t('NLP Package');
    description = t(
      'Increase your transcription minutes and translations characters.'
    );
  } else if (selectedProduct.metadata.storage_bytes_limit) {
    displayName = t('File Storage');
    description = t(
      'Get up to 50GB of media storage on a KoboToolbox public server.'
    );
  }

  const isSubscribedAddOnPrice = useMemo(
    () =>
      isChangeScheduled(selectedPrice, activeSubscriptions) ||
      subscribedAddOns.some(
        (subscription) => subscription.items[0].price.id === selectedPrice.id
      ),
    [subscribedAddOns, selectedPrice]
  );

  const onChangeProduct = (productId: string) => {
    const product = products.find((product) => product.id === productId);
    if (product) {
      setSelectedProduct(product);
      setSelectedPrice(product.prices[0]);
    }
  };

  const onChangePrice = (inputPrice: string | null) => {
    if (inputPrice) {
      const priceObject = selectedProduct.prices.find(
        (price) => inputPrice === price.id
      );
      if (priceObject) {
        setSelectedPrice(priceObject);
      }
    }
  };

  const onChangeQuantity = (quantity: string | null) => {
    if (quantity) {
      setQuantity(quantity);
    }
  };

  // TODO: Merge functionality of onClickBuy and onClickManage so we can unduplicate
  // the billing button in priceTableCells
  const onClickBuy = () => {
    if (isBusy || !selectedPrice) {
      return;
    }
    setIsBusy(true);
    if (selectedPrice) {
      postCheckout(selectedPrice.id, organization.id, parseInt(quantity))
        .then((response) => window.location.assign(response.url))
        .catch(() => setIsBusy(false));
    }
  };

  const onClickManage = () => {
    if (isBusy || !selectedPrice) {
      return;
    }
    setIsBusy(true);
    postCustomerPortal(organization.id)
      .then((response) => window.location.assign(response.url))
      .catch(() => setIsBusy(false));
  };

  const priceTableCells = (
    <>
      <div className={styles.oneTimePrice}>
        {selectedPrice.recurring?.interval === 'year'
          ? selectedPrice.human_readable_price
          : displayPrice}
      </div>
      <div className={styles.buy}>
        {isSubscribedAddOnPrice && (
          <BillingButton
            size={'m'}
            label={t('Manage')}
            isDisabled={Boolean(selectedPrice) && isBusy}
            onClick={onClickManage}
            isFullWidth
          />
        )}
        {!isSubscribedAddOnPrice && (
          <BillingButton
            size={'m'}
            label={t('Buy now')}
            isDisabled={Boolean(selectedPrice) && isBusy}
            onClick={onClickBuy}
            isFullWidth
          />
        )}
      </div>
    </>
  );

  return (
    <tr className={styles.row}>
      <td className={styles.productName}>
        {displayName}
        {description && <p className={styles.description}>{description}</p>}
        <div className={styles.mobileView}>
          {priceTableCells}
        </div>
      </td>
      <td className={styles.price}>
        <div className={styles.oneTime}>
          <KoboSelect3
            size='m'
            name='products'
            options={products.map((product) => {
              return {value: product.id, label: product.name};
            })}
            onChange={(productId) => onChangeProduct(productId as string)}
            value={selectedProduct.id}
          />
          {displayName === 'File Storage' ? (
            <KoboSelect3
              size={'fit'}
              name={t('prices')}
              options={priceOptions}
              onChange={onChangePrice}
              value={selectedPrice.id}
            />
          ) : (
            <KoboSelect3
              size={'fit'}
              name={t('quantity')}
              options={quantityOptions}
              onChange={onChangeQuantity}
              value={quantity}
            />
          )}
        </div>
      </td>
      <td className={styles.fullScreen}>
        {priceTableCells}
      </td>
    </tr>
  );
};
