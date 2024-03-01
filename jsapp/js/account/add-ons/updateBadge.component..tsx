import {
  BaseProduct,
  Price,
  SubscriptionChangeType,
  SubscriptionInfo,
} from 'js/account/stripe.types';
import Badge, {BadgeColor} from 'js/components/common/badge';
import {formatDate} from 'js/utils';
import React from 'react';

interface UpdateBadgeProps {
  price: Price;
  subscriptionUpdate: {
    type: SubscriptionChangeType;
    nextProduct: BaseProduct | null;
    date: string;
  };
  currentAddon: SubscriptionInfo | null;
}

export const UpdateBadge = ({
  price,
  subscriptionUpdate,
  currentAddon,
}: UpdateBadgeProps) => {
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
