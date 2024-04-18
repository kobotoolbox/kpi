import styles from 'js/account/add-ons/addOnList.module.scss';
import React, {useMemo, useState} from 'react';
import type {Organization, Product} from 'js/account/stripe.types';
import KoboSelect3 from 'js/components/special/koboAccessibleSelect';
import type {KoboSelectOption} from 'js/components/common/koboSelect';
import BillingButton from 'js/account/plans/billingButton.component';
import {postCheckout} from 'js/account/stripe.api';
import {useDisplayPrice} from 'js/account/plans/useDisplayPrice.hook';

interface OneTimeAddOnRowProps {
  products: Product[];
  isDisabled: boolean;
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
  isDisabled,
  organization,
}: OneTimeAddOnRowProps) => {
  const [selectedProduct, setSelectedProduct] = useState(products[0]);
  const [quantity, setQuantity] = useState('1');
  const [selectedPrice, setSelectedPrice] = useState<Product['prices'][0]>(
    selectedProduct.prices[0]
  );
  const displayPrice = useDisplayPrice(selectedPrice, parseInt(quantity));
  const priceOptions: KoboSelectOption[] = useMemo(
    () =>
      selectedProduct.prices.map((price) => {
        return {value: price.id, label: price.recurring?.interval || 'me'};
      }),
    [selectedProduct]
  );

  let displayName;
  let description;

  if (selectedProduct.metadata.asr_seconds_limit || selectedProduct.metadata.mt_characters_limit) {
    displayName = t('NLP Package');
    description =
      t('Increase your transcription minutes and translations characters.');
  } else if (selectedProduct.metadata.storage_bytes_limit) {
    displayName = t('File Storage');
    description =
      t('Get up to 50GB of media storage on a KoboToolbox public server.');
  }

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

  const onClickBuy = () => {
    if (selectedPrice) {
      postCheckout(selectedPrice.id, organization.id, parseInt(quantity))
        .then((response) => window.location.assign(response.url))
        .catch((error) => {
          console.log(error);
        });
    }
  };

  return (
    <tr>
      <td className={styles.productName}>
        {displayName}
        {description && <p className={styles.description}>{description}</p>}
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
              name='prices'
              options={priceOptions}
              onChange={onChangePrice}
              value={selectedPrice.id}
            />
          ) : (
            <KoboSelect3
              size={'fit'}
              name='quantity'
              options={quantityOptions}
              onChange={onChangeQuantity}
              value={quantity}
            />
          )}
        </div>
      </td>
      <td className={styles.oneTimePrice}>
        {selectedPrice.recurring?.interval === 'year'
          ? selectedPrice.human_readable_price
          : displayPrice}
      </td>
      <td className={styles.buy}>
        <BillingButton
          size={'m'}
          label='Buy now'
          isDisabled={Boolean(selectedPrice) && isDisabled}
          onClick={onClickBuy}
          isFullWidth
        />
      </td>
    </tr>
  );
};
