import styles from 'js/account/add-ons/addOnList.module.scss';
import React, {useMemo, useState} from 'react';
import {Organization, Product} from 'js/account/stripe.types';
import KoboSelect3 from 'js/components/special/koboAccessibleSelect';
import {KoboSelectOption} from 'js/components/common/koboSelect';
import BillingButton from 'js/account/plans/billingButton.component';
import {postCheckout} from 'js/account/stripe.api';
import {useDisplayPrice} from 'js/account/plans/useDisplayPrice.hook';

interface OneTimeAddOnRowProps {
  product: Product;
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
  product,
  isDisabled,
  organization,
}: OneTimeAddOnRowProps) => {
  const [quantity, setQuantity] = useState('1');
  const [selectedPrice, setSelectedPrice] = useState(product.prices?.[0]);
  const displayPrice = useDisplayPrice(selectedPrice, parseInt(quantity));
  const priceOptions: KoboSelectOption[] = useMemo(
    () =>
      product.prices.map((price) => {
        return {value: price.id, label: product.name};
      }),
    [product]
  );

  const onChangePrice = (inputPrice: string | null) => {
    if (inputPrice) {
      const priceObject = product.prices.find(
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
      <td>
        <div className={'flex'}>
          <KoboSelect3
            size='m'
            name={t('prices')}
            options={priceOptions}
            onChange={onChangePrice}
            value={selectedPrice?.id || ''}
          />
          <KoboSelect3
            size={'fit'}
            name={t('quantity')}
            options={quantityOptions}
            onChange={onChangeQuantity}
            value={quantity}
          />
        </div>
      </td>
      <td className={styles.price}>{displayPrice}</td>
      <td>
        <BillingButton
          size={'m'}
          label={t('Buy now')}
          isDisabled={Boolean(selectedPrice) && isDisabled}
          onClick={onClickBuy}
          isFullWidth
        />
      </td>
    </tr>
  );
};
