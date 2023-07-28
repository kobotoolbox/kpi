import React, {ReactNode, useEffect, useState} from 'react';
import styles from './usage.module.scss';
import {formatMonth} from '../utils';
import {getUsage} from './usage.api';
import {getAccountLimits, RecurringInterval} from "js/account/stripe.api";
import envStore from 'js/envStore';
import {when} from "mobx";
import {ACTIVE_STRIPE_STATUSES} from "js/constants";
import classnames from "classnames";
import Icon from "js/components/common/icon";
import subscriptionStore, {SubscriptionInfo} from "js/account/subscriptionStore";
import {useLocation} from "react-router-dom";
import prettyBytes from "pretty-bytes";

interface UsageState {
  storage: number;
  monthlySubmissions: number;
  monthlyTranscriptionMinutes: number;
  monthlyTranslationChars: number;
  storageByteLimit: number|'unlimited';
  nlpCharacterLimit: number|'unlimited';
  nlpMinuteLimit: number|'unlimited';
  submissionLimit: number|'unlimited';
  trackingPeriod: RecurringInterval;
  currentMonthStart: Date;
  currentYearStart: Date;
}

const WARNING_THRESHOLD_RATIO = 0.8;

export default function Usage() {
  const [usage, setUsage] = useState<UsageState>({
    storage: 0,
    monthlySubmissions: 0,
    monthlyTranscriptionMinutes: 0,
    monthlyTranslationChars: 0,
    storageByteLimit: 'unlimited',
    nlpCharacterLimit: 'unlimited',
    nlpMinuteLimit: 'unlimited',
    submissionLimit: 'unlimited',
    trackingPeriod: RecurringInterval.Month,
    currentMonthStart: new Date(),
    currentYearStart: new Date(),
  });

  const location = useLocation();

  const truncate = (decimal: number) => {
    return parseFloat(decimal.toFixed(2));
  };

  useEffect(() => {
    const getLimits = async () => {
      await when(() => envStore.isReady);
      if (envStore.data.stripe_public_key) {
        return await getAccountLimits();
      }
      return null;
    };

    getLimits().then((limits) => {
      if (limits) {
      setUsage((prevState) => {
          return {
            ...prevState,
            storageByteLimit: limits.storage_bytes_limit,
            nlpCharacterLimit: limits.nlp_character_limit,
            nlpMinuteLimit: typeof limits.nlp_seconds_limit === 'number' ?
              limits.nlp_seconds_limit as number / 60 :
              limits.nlp_seconds_limit,
            submissionLimit: limits.submission_limit,
          };
        });
      }
    });
  }, []);

  useEffect(() => {
    if (envStore.isReady && envStore.data.stripe_public_key && subscriptionStore.isLoaded) {
      const subscriptionList: SubscriptionInfo[] = [...subscriptionStore.subscriptionResponse];
      const activeSubscription = subscriptionList.find((sub) =>
        ACTIVE_STRIPE_STATUSES.includes(sub.status)
      );
      let subscriptionInterval: RecurringInterval|undefined;
      if (activeSubscription) {
        subscriptionInterval = activeSubscription.items[0].price.recurring?.interval;
      }
      setUsage((prevState) => {
        return {
          ...prevState,
          trackingPeriod: subscriptionInterval || prevState.trackingPeriod,
        };
      });
    }
  }, [envStore.isReady, subscriptionStore.isLoaded]);

  // if stripe is enabled, load fresh subscription info whenever we navigate to this route
  useEffect(() => {
    if (envStore.isReady && envStore.data.stripe_public_key) {
      subscriptionStore.fetchSubscriptionInfo();
    }
  }, [envStore.isReady, location]);

  // load fresh usage data on every page load and whenever switching routes to this page
  useEffect(() => {
    getUsage().then((data) => {
      setUsage((prevState) => {
        return {
          ...prevState,
          storage: data.total_storage_bytes,
          monthlySubmissions: data.total_submission_count['current_month'],
          monthlyTranscriptionMinutes: Math.floor(
            truncate(data.total_nlp_usage['asr_seconds_current_month'] / 60)
          ), // seconds to minutes
          monthlyTranslationChars:
            data.total_nlp_usage['mt_characters_current_month'],
          currentMonthStart: new Date(Date.parse(data.current_month_start)),
          currentYearStart: new Date(Date.parse(data.current_year_start)),
        };
      });
    });
  }, [location]);

  return (
    <div className={styles.root}>
      <h2>{t('Your account total use')}</h2>

      <div className={styles.row}>
        <div className={styles.box}>
          <strong className={styles.title}>{t('Submissions')}</strong>
          <div className={styles.date}>
            {formatMonth(new Date().toUTCString())}
          </div>
          <UsageContainer
            usage={usage.monthlySubmissions}
            limit={usage.submissionLimit}
            period={usage.trackingPeriod}
          />
        </div>
        <div className={styles.box}>
          <strong className={styles.title}>{t('Storage')}</strong>
          <div className={styles.date}>{t('per account')}</div>
          <UsageContainer
            usage={usage.storage}
            limit={usage.storageByteLimit}
            period={usage.trackingPeriod}
            isStorage
          />
        </div>
        <div className={styles.box}>
          <strong className={styles.title}>{t('Transcription minutes')}</strong>
          <div className={styles.date}>
            {formatMonth(new Date().toUTCString())}
          </div>
          <UsageContainer
            usage={usage.monthlyTranscriptionMinutes}
            limit={usage.nlpMinuteLimit}
            period={usage.trackingPeriod}
          />
        </div>
        <div className={styles.box}>
          <strong className={styles.title}>
            {t('Translation characters')}
          </strong>
          <div className={styles.date}>
            {formatMonth(new Date().toUTCString())}
          </div>
          <UsageContainer
            usage={usage.monthlyTranslationChars}
            limit={usage.nlpCharacterLimit}
            period={usage.trackingPeriod}
            label={t('Total')}
          />
        </div>
      </div>
    </div>
  );
}

interface UsageContainerProps {
  usage: number;
  limit: number|'unlimited';
  label?: string;
  isStorage?: boolean;
  period: RecurringInterval;
}

const UsageContainer = ({usage, limit, period, label = undefined, isStorage = false}: UsageContainerProps) => {
  let limitRatio = 0;
  if (limit !== 'unlimited' && limit) {
    limitRatio = usage / limit;
  }
  const isOverLimit = limitRatio > 1;
  const isNearingLimit = !isOverLimit && limitRatio > WARNING_THRESHOLD_RATIO;
  return (
    <div className={classnames(
      styles.usage,
      {
        [styles.warning]: isNearingLimit,
        [styles.overlimit]: isOverLimit,
      },
    )}>
      {isNearingLimit &&
        <Icon name={'warning'} color={'amber'} size={'m'}/>
      }
      {isOverLimit &&
        <Icon name={'warning'} color={'red'} size={'m'}/>
      }
        <strong className={styles.description}>
          {label ||
            (period === 'month' ? t('Monthly') : t('Yearly'))
          }
        </strong>
        {!usage && <span>-</span>}
        {Boolean(usage) && (
          <>
            <strong>{isStorage ? prettyBytes(usage) : usage.toLocaleString()}</strong>
            {(limit !== 'unlimited' && limit) &&
              <>
                <span aria-hidden className={styles.delimiter}>/</span>
                <span className={styles.visuallyHidden}>
                  {t('used out of')}
                </span>
                <span>{isStorage ? prettyBytes(limit): limit.toLocaleString()}</span>
              </>
            }
          </>
        )}
    </div>
  );
};
