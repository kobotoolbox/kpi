import {when} from 'mobx';
import React, {useContext, useEffect, useMemo, useState} from 'react';
import {useLocation} from 'react-router-dom';
import type {AccountLimit, LimitAmount} from 'js/account/stripe.types';
import {Limits} from 'js/account/stripe.types';
import {getAccountLimits} from 'js/account/stripe.api';
import subscriptionStore from 'js/account/subscriptionStore';
import LoadingSpinner from 'js/components/common/loadingSpinner';
import UsageContainer, {
  USAGE_CONTAINER_TYPE,
} from 'js/account/usage/usageContainer';
import envStore from 'js/envStore';
import {formatDate} from 'js/utils';
import styles from './usage.module.scss';
import useWhenStripeIsEnabled from 'js/hooks/useWhenStripeIsEnabled.hook';
import {ProductsContext} from '../useProducts.hook';
import {UsageContext} from 'js/account/usage/useUsage.hook';
import moment from 'moment';
import {YourPlan} from 'js/account/usage/yourPlan.component';
import cx from 'classnames';
import LimitNotifications from 'js/components/usageLimits/limitNotifications.component';
import {useRefreshApiFetcher} from 'js/hooks/useRefreshApiFetcher.hook';

interface LimitState {
  storageByteLimit: LimitAmount;
  nlpCharacterLimit: LimitAmount;
  nlpMinuteLimit: LimitAmount;
  submissionLimit: LimitAmount;
  isLoaded: boolean;
  stripeEnabled: boolean;
}

export default function Usage() {
  const [products] = useContext(ProductsContext);
  const [usage, loadUsage, usageStatus] = useContext(UsageContext);
  useRefreshApiFetcher(loadUsage, usageStatus);

  const [limits, setLimits] = useState<LimitState>({
    storageByteLimit: Limits.unlimited,
    nlpCharacterLimit: Limits.unlimited,
    nlpMinuteLimit: Limits.unlimited,
    submissionLimit: Limits.unlimited,
    isLoaded: false,
    stripeEnabled: false,
  });

  const location = useLocation();

  const isFullyLoaded = useMemo(
    () =>
      !usageStatus.pending &&
      !usageStatus.error &&
      (products.isLoaded || !limits.stripeEnabled) &&
      limits.isLoaded,
    [usageStatus, products.isLoaded, limits.isLoaded, limits.stripeEnabled]
  );

  const dateRange = useMemo(() => {
    let startDate: string;
    const endDate = usage.billingPeriodEnd
      ? formatDate(usage.billingPeriodEnd)
      : formatDate(
          moment(usage.currentMonthStart).add(1, 'month').toISOString()
        );
    switch (usage.trackingPeriod) {
      case 'year':
        startDate = formatDate(usage.currentYearStart);
        break;
      default:
        startDate = formatDate(usage.currentMonthStart);
        break;
    }
    return t('##start_date## to ##end_date##')
      .replace('##start_date##', startDate)
      .replace('##end_date##', endDate);
  }, [
    usage.currentYearStart,
    usage.currentMonthStart,
    usage.billingPeriodEnd,
    usage.trackingPeriod,
  ]);

  // check if stripe is enabled - if so, get limit data
  useEffect(() => {
    const getLimits = async () => {
      await when(() => envStore.isReady);
      let limits: AccountLimit;
      if (envStore.data.stripe_public_key) {
        limits = await getAccountLimits(products.products);
      } else {
        setLimits((prevState) => {
          return {
            ...prevState,
            isLoaded: true,
          };
        });
        return;
      }

      setLimits((prevState) => {
        return {
          ...prevState,
          storageByteLimit: limits.storage_bytes_limit,
          nlpCharacterLimit: limits.nlp_character_limit,
          nlpMinuteLimit:
            typeof limits.nlp_seconds_limit === 'number'
              ? limits.nlp_seconds_limit / 60
              : limits.nlp_seconds_limit,
          submissionLimit: limits.submission_limit,
          isLoaded: true,
          stripeEnabled: true,
        };
      });
    };

    getLimits();
  }, [products.isLoaded]);

  // if stripe is enabled, load fresh subscription info whenever we navigate to this route
  useWhenStripeIsEnabled(() => {
    subscriptionStore.fetchSubscriptionInfo();
  }, [location]);

  if (!isFullyLoaded) {
    return <LoadingSpinner />;
  }

  return (
    <div className={styles.root}>
      <LimitNotifications accountPage />
      <header className={styles.header}>
        <h2 className={styles.headerText}>{t('Your usage')}</h2>
        {typeof usage.lastUpdated === 'string' && (
          <p className={styles.updated}>
            {t('Last update: ##LAST_UPDATE_TIME##').replace(
              '##LAST_UPDATE_TIME##',
              usage.lastUpdated
            )}
          </p>
        )}
      </header>
      {limits.stripeEnabled && <YourPlan />}
      <div className={styles.row}>
        <div className={cx(styles.row, styles.subrow)}>
          <div className={styles.box}>
            <span>
              <strong className={styles.title}>{t('Submissions')}</strong>
              <time className={styles.date}>{dateRange}</time>
            </span>
            <UsageContainer
              usage={usage.submissions}
              limit={limits.submissionLimit}
              period={usage.trackingPeriod}
            />
          </div>
          <div className={styles.box}>
            <span>
              <strong className={styles.title}>{t('Storage')}</strong>
              <div className={styles.date}>{t('per account')}</div>
            </span>
            <UsageContainer
              usage={usage.storage}
              limit={limits.storageByteLimit}
              period={usage.trackingPeriod}
              label={t('Total')}
              type={USAGE_CONTAINER_TYPE.STORAGE}
            />
          </div>
        </div>
        <div className={cx(styles.row, styles.subrow)}>
          <div className={styles.box}>
            <span>
              <strong className={styles.title}>
                {t('Transcription minutes')}
              </strong>
              <time className={styles.date}>{dateRange}</time>
            </span>
            <UsageContainer
              usage={usage.transcriptionMinutes}
              limit={limits.nlpMinuteLimit}
              period={usage.trackingPeriod}
              type={USAGE_CONTAINER_TYPE.TRANSCRIPTION}
            />
          </div>
          <div className={styles.box}>
            <span>
              <strong className={styles.title}>
                {t('Translation characters')}
              </strong>
              <time className={styles.date}>{dateRange}</time>
            </span>
            <UsageContainer
              usage={usage.translationChars}
              limit={limits.nlpCharacterLimit}
              period={usage.trackingPeriod}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
