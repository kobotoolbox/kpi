import styles from 'js/account/plans/plan.module.scss';
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {BasePrice} from 'js/account/stripe.types';

interface PriceDisplayProps {
  price: BasePrice;
  submissionQuantity: number;
}

export const PriceDisplay = ({
  price,
  submissionQuantity,
}: PriceDisplayProps) => {
  const priceDisplay = useMemo(() => {
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

  return <div className={styles.priceTitle}>{priceDisplay}</div>;
};
