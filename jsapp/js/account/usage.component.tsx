import {when} from 'mobx';
import React, {useEffect, useMemo, useState} from 'react';
import {useLocation} from 'react-router-dom';
import type {AccountLimit, RecurringInterval} from 'js/account/stripe.api';
import {getAccountLimits, getSubscriptionInterval} from 'js/account/stripe.api';
import subscriptionStore from 'js/account/subscriptionStore';
import LoadingSpinner from 'js/components/common/loadingSpinner';
import UsageContainer from 'js/components/usageContainer';
import envStore from 'js/envStore';
import {formatDate, truncateNumber} from 'js/utils';
import {getUsageForOrganization} from './usage.api';
import styles from './usage.module.scss';
import LimitNotifications from 'js/components/usageLimits/limitNotifications.component';

interface UsageState {
  storage: number;
  submissions: number;
  transcriptionMinutes: number;
  translationChars: number;
  storageByteLimit: number | 'unlimited';
  nlpCharacterLimit: number | 'unlimited';
  nlpMinuteLimit: number | 'unlimited';
  submissionLimit: number | 'unlimited';
  trackingPeriod: RecurringInterval;
  currentMonthStart: string;
  currentYearStart: string;
  isUsageLoaded: boolean;
  isLimitsLoaded: boolean;
  isSubscriptionLoaded: boolean;
}

export default function Usage() {
  const [usage, setUsage] = useState<UsageState>({
    storage: 0,
    submissions: 0,
    transcriptionMinutes: 0,
    translationChars: 0,
    storageByteLimit: 'unlimited',
    nlpCharacterLimit: 'unlimited',
    nlpMinuteLimit: 'unlimited',
    submissionLimit: 'unlimited',
    trackingPeriod: 'month',
    currentMonthStart: '',
    currentYearStart: '',
    isUsageLoaded: false,
    isLimitsLoaded: false,
    isSubscriptionLoaded: false,
  });

  const location = useLocation();

  const isFullyLoaded = useMemo(
    () =>
      usage.isUsageLoaded && usage.isLimitsLoaded && usage.isSubscriptionLoaded,
    [usage.isUsageLoaded, usage.isLimitsLoaded, usage.isSubscriptionLoaded]
  );

  const shortDate = useMemo(() => {
    let format: string;
    let date: string;
    switch (usage.trackingPeriod) {
      case 'year':
        format = 'YYYY';
        date = usage.currentYearStart;
        break;
      default:
        format = 'MMM YYYY';
        date = usage.currentMonthStart;
        break;
    }
    return formatDate(date, false, format);
  }, [usage.currentYearStart, usage.currentMonthStart, usage.trackingPeriod]);

  const dateRange = useMemo(() => {
    let startDate: string;
    const endDate = formatDate(new Date().toUTCString());
    switch (usage.trackingPeriod) {
      case 'year':
        startDate = formatDate(usage.currentYearStart, false);
        break;
      default:
        startDate = formatDate(usage.currentMonthStart, false);
        break;
    }
    return t('##start_date## to ##end_date##')
      .replace('##start_date##', startDate)
      .replace('##end_date##', endDate);
  }, [usage.currentYearStart, usage.currentMonthStart, usage.trackingPeriod]);

  useEffect(() => {
    const getLimits = async () => {
      await when(() => envStore.isReady);
      let limits: AccountLimit;
      if (envStore.data.stripe_public_key) {
        limits = await getAccountLimits();
      } else {
        setUsage((prevState) => {
          return {
            ...prevState,
            isLimitsLoaded: true,
          };
        });
        return;
      }

      setUsage((prevState) => {
        return {
          ...prevState,
          storageByteLimit: limits.storage_bytes_limit,
          nlpCharacterLimit: limits.nlp_character_limit,
          nlpMinuteLimit:
            typeof limits.nlp_seconds_limit === 'number'
              ? limits.nlp_seconds_limit / 60
              : limits.nlp_seconds_limit,
          submissionLimit: limits.submission_limit,
          isLimitsLoaded: true,
        };
      });
    };

    getLimits();
  }, []);

  // get subscription interval (monthly, yearly) from the subscriptionStore when ready
  useEffect(() => {
    getSubscriptionInterval().then((subscriptionInterval) => {
      setUsage((prevState) => {
        return {
          ...prevState,
          trackingPeriod: subscriptionInterval || 'month',
          isSubscriptionLoaded: true,
        };
      });
    });
  }, []);

  // if stripe is enabled, load fresh subscription info whenever we navigate to this route
  useEffect(() => {
    when(() => envStore.isReady).then(() => {
      if (envStore.data.stripe_public_key) {
        subscriptionStore.fetchSubscriptionInfo();
      }
    });
  }, [location]);

  // load fresh usage data on every page load and whenever switching routes to this page
  useEffect(() => {
    if (!usage.isSubscriptionLoaded) {
      return;
    }
    getUsageForOrganization().then((data) => {
      if (!data) {
        return;
      }
      setUsage((prevState) => {
        return {
          ...prevState,
          storage: data.total_storage_bytes,
          submissions:
            data.total_submission_count[`current_${usage.trackingPeriod}`],
          transcriptionMinutes: Math.floor(
            truncateNumber(
              data.total_nlp_usage[
                `asr_seconds_current_${usage.trackingPeriod}`
              ] / 60
            )
          ), // seconds to minutes
          translationChars:
            data.total_nlp_usage[
              `mt_characters_current_${usage.trackingPeriod}`
            ],
          currentMonthStart: data.current_month_start,
          currentYearStart: data.current_year_start,
          isUsageLoaded: true,
        };
      });
    });

    getUsageForOrganization();
  }, [location, usage.isSubscriptionLoaded]);

  if (!isFullyLoaded) {
    return <LoadingSpinner />;
  }

  return (
    <div className={styles.root}>
      <h2>{t('Your account total use')}</h2>
      <LimitNotifications usagePage />
      <div className={styles.row}>
        <div className={styles.box}>
          <span>
            <strong className={styles.title}>{t('Submissions')}</strong>
            <time className={styles.date}>{dateRange}</time>
          </span>
          <UsageContainer
            usage={usage.submissions}
            limit={usage.submissionLimit}
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
            limit={usage.storageByteLimit}
            period={usage.trackingPeriod}
            label={t('Total')}
            isStorage
          />
        </div>
        <div className={styles.box}>
          <span>
            <strong className={styles.title}>
              {t('Transcription minutes')}
            </strong>
            <time className={styles.date}>{shortDate}</time>
          </span>
          <UsageContainer
            usage={usage.transcriptionMinutes}
            limit={usage.nlpMinuteLimit}
            period={usage.trackingPeriod}
          />
        </div>
        <div className={styles.box}>
          <span>
            <strong className={styles.title}>
              {t('Translation characters')}
            </strong>
            <time className={styles.date}>{shortDate}</time>
          </span>
          <UsageContainer
            usage={usage.translationChars}
            limit={usage.nlpCharacterLimit}
            period={usage.trackingPeriod}
          />
        </div>
      </div>
    </div>
  );
}
