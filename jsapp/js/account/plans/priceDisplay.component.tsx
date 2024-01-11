import styles from 'js/account/plans/plan.module.scss';
import React from 'react';
import {BasePrice} from 'js/account/stripe.types';

interface PriceDisplayProps {
  price: BasePrice;
}

export const PriceDisplay = ({price}: PriceDisplayProps) => {
  let amount = '';
  if (!price?.unit_amount) {
    amount = t('Free');
  } else if (price?.recurring?.interval === 'year') {
    amount = t('$##price## USD/month').replace(
      '##price##',
      (price?.unit_amount / 100 / 12).toFixed(2)
    );
  } else {
    amount = price.human_readable_price;
  }

  return <div className={styles.priceTitle}>{amount}</div>;
};
