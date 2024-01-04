import {when} from 'mobx';
import React, {useEffect, useMemo, useState} from 'react';
import {useLocation} from 'react-router-dom';
import type {AccountLimit} from 'js/account/stripe.types';
import {getAccountLimits} from 'js/account/stripe.api';
import subscriptionStore from 'js/account/subscriptionStore';
import LoadingSpinner from 'js/components/common/loadingSpinner';
import UsageContainer from 'js/account/usage/usageContainer';
import envStore from 'js/envStore';
import {formatDate} from 'js/utils';
import styles from './usage.module.scss';
import LimitNotifications from 'js/components/usageLimits/limitNotifications.component';
import useWhenStripeIsEnabled from 'js/hooks/useWhenStripeIsEnabled.hook';
import {UsageContext, useUsage} from 'js/account/usage/useUsage.hook';
import moment from 'moment';

interface LimitState {
  storageByteLimit: number | 'unlimited';
  nlpCharacterLimit: number | 'unlimited';
  nlpMinuteLimit: number | 'unlimited';
  submissionLimit: number | 'unlimited';
  isLoaded: boolean;
}

export default function Usage() {
  const usage = useUsage();

  const [limits, setLimits] = useState<LimitState>({
    storageByteLimit: 'unlimited',
    nlpCharacterLimit: 'unlimited',
    nlpMinuteLimit: 'unlimited',
    submissionLimit: 'unlimited',
    isLoaded: false,
  });

  const location = useLocation();

  const isFullyLoaded = useMemo(
    () => usage.isLoaded && limits.isLoaded,
    [usage.isLoaded, limits.isLoaded]
  );

  const dateRange = useMemo(() => {
    let startDate: string;
    const endDate = usage.billingPeriodEnd
      ? formatDate(usage.billingPeriodEnd, false)
      : formatDate(moment().endOf('month').toISOString());
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
        };
      });
    };

    getLimits();
  }, []);

  // if stripe is enabled, load fresh subscription info whenever we navigate to this route
  useWhenStripeIsEnabled(() => {
    subscriptionStore.fetchSubscriptionInfo();
  }, [location]);

  if (!isFullyLoaded) {
    return <LoadingSpinner />;
  }

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <h2>{t('Your account total use')}</h2>
        {typeof usage.lastUpdated === 'string' && (
          <p className={styles.updated}>
            {t('Last update: ##LAST_UPDATE_TIME##').replace(
              '##LAST_UPDATE_TIME##',
              usage.lastUpdated
            )}
          </p>
        )}
      </header>
      <UsageContext.Provider value={usage}>
        <LimitNotifications usagePage />
      </UsageContext.Provider>
      <div className={styles.row}>
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
            isStorage
          />
        </div>
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
  );
}
