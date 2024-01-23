import {useMemo} from 'react';
import {BasePrice} from 'js/account/stripe.types';

export const useDisplayPrice = (
  price: BasePrice | null,
  submissionQuantity = 1
) => {
  return useMemo(() => {
    if (!price?.unit_amount) {
      return t('Free');
    }
    let totalPrice = 1;
    if (price.transform_quantity?.divide_by) {
      totalPrice =
        (totalPrice * submissionQuantity) / price.transform_quantity.divide_by;
    }
    if (price.transform_quantity?.round === 'up') {
      totalPrice = Math.ceil(totalPrice);
    }
    if (price.transform_quantity?.round === 'down') {
      totalPrice = Math.floor(totalPrice);
    }
    if (price?.recurring?.interval === 'year') {
      totalPrice /= 12;
    }
    totalPrice *= price.unit_amount / 100;
    return t('$##price## USD/month').replace(
      '##price##',
      totalPrice.toFixed(2)
    );
  }, [submissionQuantity, price]);
};
