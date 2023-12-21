import prettyBytes from 'pretty-bytes';
import React, {useCallback, useMemo, useState} from 'react';
import type {LimitAmount, RecurringInterval} from 'js/account/stripe.types';
import Icon from 'js/components/common/icon';
import styles from 'js/account/usage/usageContainer.module.scss';
import {USAGE_WARNING_RATIO} from 'js/constants';
import {Limits} from 'js/account/stripe.types';
import cx from 'classnames';
import subscriptionStore from 'js/account/subscriptionStore';
import Badge from 'js/components/common/badge';

export enum USAGE_CONTAINER_TYPE {
  'TRANSCRIPTION',
  'STORAGE',
}

interface UsageContainerProps {
  usage: number;
  limit: LimitAmount;
  period: RecurringInterval;
  label?: string;
  type?: USAGE_CONTAINER_TYPE;
}

const UsageContainer = ({
  usage,
  limit,
  period,
  label = undefined,
  type = undefined,
}: UsageContainerProps) => {
  const [subscriptions] = useState(() => subscriptionStore);
  const hasStorageAddOn = useMemo(
    () => subscriptions.addOnsResponse.length > 0,
    [subscriptions.addOnsResponse]
  );
  let limitRatio = 0;
  if (limit !== Limits.unlimited && limit) {
    limitRatio = usage / limit;
  }
  const isOverLimit = limitRatio >= 1;
  const isNearingLimit = !isOverLimit && limitRatio > USAGE_WARNING_RATIO;

  /**
   * Render a limit amount, usage amount, or total balance as readable text
   * @param {number|'unlimited'} amount - The limit/usage amount
   * @param {number|'unlimited'|null} [available=null] - If we're showing a balance,
   * `amount` takes the usage amount and this takes the limit amount
   */
  const limitDisplay = useCallback(
    (amount, available = null) => {
      if (amount === Limits.unlimited || available === Limits.unlimited) {
        return t('Unlimited');
      }
      const total = available ? available - amount : amount;
      switch (type) {
        case USAGE_CONTAINER_TYPE.STORAGE:
          return prettyBytes(total);
        case USAGE_CONTAINER_TYPE.TRANSCRIPTION:
          return t('##minutes## mins').replace(
            '##minutes##',
            total.toLocaleString()
          );
        default:
          return total.toLocaleString();
      }
    },
    [limit, type, usage]
  );

  return (
    <>
      <ul className={cx(styles.usage, {[styles.hasAddon]: hasStorageAddOn})}>
        {limit && (
          <li>
            <label>{t('Available')}</label>
            <data value={limit}>{limitDisplay(limit)}</data>
          </li>
        )}
        <li>
          <label>
            {label ||
              (period === 'month' ? t('Used this month') : t('Used this year'))}
          </label>
          <data>{limitDisplay(usage)}</data>
        </li>
        <li>
          <strong>{t('Balance')}</strong>
          <strong
            className={cx({
              [styles.warning]: isNearingLimit,
              [styles.overlimit]: isOverLimit,
            })}
          >
            {isNearingLimit && <Icon name='warning' color='amber' size='m' />}
            {isOverLimit && <Icon name='warning' color='red' size='m' />}
            {limitDisplay(usage, limit)}
          </strong>
        </li>
        {hasStorageAddOn && type === USAGE_CONTAINER_TYPE.STORAGE && (
          <li>
            <Badge
              color={'light-blue'}
              size={'m'}
              label={
                <strong>
                  {
                    subscriptions.addOnsResponse[0].items?.[0].price.product
                      .name
                  }
                </strong>
              }
            />
          </li>
        )}
      </ul>
    </>
  );
};

export default UsageContainer;
