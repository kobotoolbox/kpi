import {useMemo} from 'react';
import {Price} from 'js/account/stripe.types';
import {getAdjustedQuantityForPrice} from 'js/account/stripe.utils';

export const useDisplayPrice = (
  price?: Price | null,
  submissionQuantity = 1
) => {
  return useMemo(() => {
    if (!price?.unit_amount) {
      return t('Free');
    }
    let totalPrice = price.unit_amount / 100;
    if (price?.recurring?.interval === 'year') {
      totalPrice /= 12;
    }
    totalPrice *= getAdjustedQuantityForPrice(
      submissionQuantity,
      price.transform_quantity
    );
    if (!price?.recurring?.interval) {
      return t('$##price##').replace(
      '##price##',
      totalPrice.toFixed(2)
    );
    }
    return t('$##price## USD/month').replace(
      '##price##',
      totalPrice.toFixed(2)
    );
  }, [submissionQuantity, price]);
};
