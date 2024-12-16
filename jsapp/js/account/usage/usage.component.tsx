import {when} from 'mobx';
import React, {useContext, useEffect, useMemo, useState} from 'react';
import {useLocation} from 'react-router-dom';
import type {AccountLimitDetail, LimitAmount, OneTimeAddOn} from 'js/account/stripe.types';
import {Limits, USAGE_TYPE} from 'js/account/stripe.types';
import {getAccountLimits} from 'js/account/stripe.api';
import subscriptionStore from 'js/account/subscriptionStore';
import LoadingSpinner from 'js/components/common/loadingSpinner';
import UsageContainer from 'js/account/usage/usageContainer';
import envStore from 'js/envStore';
import {convertSecondsToMinutes, formatDate} from 'js/utils';
import styles from './usage.module.scss';
import useWhenStripeIsEnabled from 'js/hooks/useWhenStripeIsEnabled.hook';
import {ProductsContext} from '../useProducts.hook';
import {UsageContext} from 'js/account/usage/useUsage.hook';
import {OneTimeAddOnsContext} from '../useOneTimeAddonList.hook';
import {YourPlan} from 'js/account/usage/yourPlan.component';
import cx from 'classnames';
import LimitNotifications from 'js/components/usageLimits/limitNotifications.component';
import {useRefreshApiFetcher} from 'js/hooks/useRefreshApiFetcher.hook';

interface LimitState {
  storageByteRemainingLimit: LimitAmount;
  storageByteRecurringLimit: LimitAmount;
  nlpCharacterRemainingLimit: LimitAmount;
  nlpCharacterRecurringLimit: LimitAmount;
  nlpMinuteRemainingLimit: LimitAmount;
  nlpMinuteRecurringLimit: LimitAmount;
  submissionsRemainingLimit: LimitAmount;
  submissionsRecurringLimit: LimitAmount;
  isLoaded: boolean;
  stripeEnabled: boolean;
}

export default function Usage() {
  const [products] = useContext(ProductsContext);
  const [usage, loadUsage, usageStatus] = useContext(UsageContext);
  const oneTimeAddOnsContext = useContext(OneTimeAddOnsContext);
  useRefreshApiFetcher(loadUsage, usageStatus);

  const [limits, setLimits] = useState<LimitState>({
    storageByteRemainingLimit: Limits.unlimited,
    storageByteRecurringLimit: Limits.unlimited,
    nlpCharacterRemainingLimit: Limits.unlimited,
    nlpCharacterRecurringLimit: Limits.unlimited,
    nlpMinuteRemainingLimit: Limits.unlimited,
    nlpMinuteRecurringLimit: Limits.unlimited,
    submissionsRemainingLimit: Limits.unlimited,
    submissionsRecurringLimit: Limits.unlimited,
    isLoaded: false,
    stripeEnabled: false,
  });

  const location = useLocation();

  const dateRange = useMemo(() => {
    const startDate = formatDate(usage.currentPeriodStart);
    const endDate = formatDate(usage.currentPeriodEnd);
    return t('##start_date## to ##end_date##')
      .replace('##start_date##', startDate)
      .replace('##end_date##', endDate);
  }, [
    usage.currentPeriodStart,
    usage.currentPeriodEnd,
    usage.trackingPeriod,
  ]);

  // check if stripe is enabled - if so, get limit data
  useEffect(() => {
    const getLimits = async () => {
      await when(() => envStore.isReady);
      let limits: AccountLimitDetail;
      if (envStore.data.stripe_public_key) {
        limits = await getAccountLimits(
          products.products,
          oneTimeAddOnsContext.oneTimeAddOns
        );
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
          storageByteRemainingLimit: limits.remainingLimits.storage_bytes_limit,
          storageByteRecurringLimit: limits.recurringLimits.storage_bytes_limit,
          nlpCharacterRemainingLimit:
            limits.remainingLimits.mt_characters_limit,
          nlpCharacterRecurringLimit:
            limits.recurringLimits.mt_characters_limit,
          nlpMinuteRemainingLimit:
            typeof limits.remainingLimits.asr_seconds_limit === 'number'
              ? convertSecondsToMinutes(limits.remainingLimits.asr_seconds_limit)
              : limits.remainingLimits.asr_seconds_limit,
          nlpMinuteRecurringLimit:
            typeof limits.recurringLimits.asr_seconds_limit === 'number'
              ? convertSecondsToMinutes(limits.recurringLimits.asr_seconds_limit)
              : limits.recurringLimits.asr_seconds_limit,
          submissionsRemainingLimit: limits.remainingLimits.submission_limit,
          submissionsRecurringLimit: limits.recurringLimits.submission_limit,
          isLoaded: true,
          stripeEnabled: true,
        };
      });
    };

    getLimits();
  }, [products.isLoaded, oneTimeAddOnsContext.isLoaded]);

  function filterAddOns(type: USAGE_TYPE) {
    const availableAddons = oneTimeAddOnsContext.oneTimeAddOns.filter(
      (addon) => addon.is_available
    );
    
    // Find the relevant addons, but first check and make sure add-on
    // limits aren't superceded by an "unlimited" usage limit.
    switch (type) {
      case USAGE_TYPE.SUBMISSIONS:
        return limits.submissionsRecurringLimit !== Limits.unlimited
          ? availableAddons.filter(
              (addon) => addon.total_usage_limits.submission_limit
            )
          : [];
      case USAGE_TYPE.TRANSCRIPTION:
        return limits.nlpMinuteRecurringLimit !== Limits.unlimited
          ? availableAddons.filter(
              (addon) => addon.total_usage_limits.asr_seconds_limit
            )
          : [];
      case USAGE_TYPE.TRANSLATION:
        return limits.nlpCharacterRecurringLimit !== Limits.unlimited
          ? availableAddons.filter(
              (addon) => addon.total_usage_limits.mt_characters_limit
            )
          : [];
      default:
        return [];
    }
  }

  // Find out if any usage type has one-time addons so we can
  // adjust the formatting of the usage containers to accommodate
  // a detail link.
  const hasAddOnsLayout = useMemo(() => {
    let result = false;
    for (const type of [
      USAGE_TYPE.STORAGE,
      USAGE_TYPE.SUBMISSIONS,
      USAGE_TYPE.TRANSCRIPTION,
      USAGE_TYPE.TRANSLATION,
    ]) {
      const relevantAddons = filterAddOns(type);
      if (relevantAddons.length > 0) {
        result = true;
      }
    }
    return result;
  }, [oneTimeAddOnsContext.isLoaded, limits.isLoaded]);

  // if stripe is enabled, load fresh subscription info whenever we navigate to this route
  useWhenStripeIsEnabled(() => {
    subscriptionStore.fetchSubscriptionInfo();
  }, [location]);

  if (
    usageStatus.pending ||
    usageStatus.error ||
    !limits.isLoaded ||
    (limits.stripeEnabled && (!products.isLoaded || !oneTimeAddOnsContext.isLoaded))
  ) {
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
              remainingLimit={limits.submissionsRemainingLimit}
              recurringLimit={limits.submissionsRecurringLimit}
              oneTimeAddOns={filterAddOns(USAGE_TYPE.SUBMISSIONS)}
              hasAddOnsLayout={hasAddOnsLayout}
              period={usage.trackingPeriod}
              type={USAGE_TYPE.SUBMISSIONS}
            />
          </div>
          <div className={styles.box}>
            <span>
              <strong className={styles.title}>{t('Storage')}</strong>
              <div className={styles.date}>{t('per account')}</div>
            </span>
            <UsageContainer
              usage={usage.storage}
              remainingLimit={limits.storageByteRemainingLimit}
              recurringLimit={limits.storageByteRecurringLimit}
              oneTimeAddOns={filterAddOns(USAGE_TYPE.STORAGE)}
              hasAddOnsLayout={hasAddOnsLayout}
              period={usage.trackingPeriod}
              label={t('Total')}
              type={USAGE_TYPE.STORAGE}
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
              remainingLimit={limits.nlpMinuteRemainingLimit}
              recurringLimit={limits.nlpMinuteRecurringLimit}
              oneTimeAddOns={filterAddOns(USAGE_TYPE.TRANSCRIPTION)}
              hasAddOnsLayout={hasAddOnsLayout}
              period={usage.trackingPeriod}
              type={USAGE_TYPE.TRANSCRIPTION}
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
              remainingLimit={limits.nlpCharacterRemainingLimit}
              recurringLimit={limits.nlpCharacterRecurringLimit}
              oneTimeAddOns={filterAddOns(USAGE_TYPE.TRANSLATION)}
              hasAddOnsLayout={hasAddOnsLayout}
              period={usage.trackingPeriod}
              type={USAGE_TYPE.TRANSLATION}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
