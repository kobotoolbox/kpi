import React, {ReactNode, useEffect, useState} from 'react';
import styles from './usage.module.scss';
import {formatMonth} from '../utils';
import {getUsage} from './usage.api';
import {AccountLimit, RecurringInterval, getAccountLimits, getSubscription} from "js/account/stripe.api";
import envStore from 'js/envStore';
import {when} from "mobx";
import {ACTIVE_STRIPE_STATUSES} from "js/constants";
import classnames from "classnames";
import Icon from "js/components/common/icon";

interface UsageState {
  storage: number;
  monthlySubmissions: number;
  monthlyTranscriptionMinutes: number;
  monthlyTranslationChars: number;
  storageByteLimit: number|'unlimited'|undefined;
  nlpCharacterLimit: number|'unlimited'|undefined;
  nlpMinuteLimit: number|'unlimited'|undefined;
  submissionLimit: number|'unlimited'|undefined;
  subscriptionInterval: RecurringInterval|null;
}

const WARNING_THRESHOLD_RATIO = 0.8;

export default function Usage() {
  const [usage, setUsage] = useState<UsageState>({
    storage: 0,
    monthlySubmissions: 0,
    monthlyTranscriptionMinutes: 0,
    monthlyTranslationChars: 0,
    storageByteLimit: 0,
    nlpCharacterLimit: 0,
    nlpMinuteLimit: 0,
    submissionLimit: 0,
    subscriptionInterval: null,
  });

  const truncate = (decimal: number) => {
    return parseFloat(decimal.toFixed(2));
  };

  useEffect(() => {
    const getUsageAndLimits = async () => {
      const data = await getUsage();
      let limits: AccountLimit = {};
      let subscriptionInterval = null;
      await when(() => envStore.isReady);
      if (envStore.data.stripe_public_key) {
        limits = await getAccountLimits();
        const subscriptionList = await getSubscription();
        const subscription = subscriptionList.results.find((sub) =>
          ACTIVE_STRIPE_STATUSES.includes(sub.status)
        );
        if (subscription) {
          subscriptionInterval = subscription.items[0].price.recurring?.interval;
        }
      }
      return {...data, limits, subscriptionInterval};
    };
    getUsageAndLimits().then((data) => {
      setUsage({
        ...usage,
        storageByteLimit: data.limits?.storage_bytes_limit,
        nlpCharacterLimit: data.limits?.nlp_character_limit,
        nlpMinuteLimit: Number.isInteger(data.limits?.nlp_seconds_limit) ? data.limits.nlp_seconds_limit as number * 60 : data.limits?.nlp_seconds_limit,
        submissionLimit: data.limits?.submission_limit,
        subscriptionInterval: data?.subscriptionInterval || null,
        storage: data.total_storage_bytes,
        monthlySubmissions: data.total_submission_count['current_month'],
        monthlyTranscriptionMinutes: Math.floor(
          truncate(data.total_nlp_usage['asr_seconds_current_month'] / 60)
        ), // seconds to minutes
        monthlyTranslationChars:
          data.total_nlp_usage['mt_characters_current_month'],
      });
    });
  }, []);

  const bytesToGigabytes = (bytes: number) => {
    return truncate(bytes / (1024 * 1024 * 1024));
  };

  const bytesToGigabyteString = (bytes: number|'unlimited'|undefined) => {
    if (Number.isInteger(bytes)) {
      return bytesToGigabytes(bytes as number).toString() + ' ' + t('GB');
    }
    return bytes;
  };

  return (
    <div className={styles.root}>
      <h2>{t('Your account total use')}</h2>

      <div className={styles.row}>
        <div className={styles.box}>
          <strong className={styles.title}>{t('Submissions')}</strong>
          <div className={styles.date}>
            {formatMonth(new Date().toUTCString())}
          </div>
          <div className={styles.usage}>
            <strong className={styles.description}>{t('Monthly use')}</strong>
            <strong>{usage.monthlySubmissions}</strong>
            <LimitRow
              limit={usage.submissionLimit?.toLocaleString()}
              isVisible={usage.monthlySubmissions > 0}
            />
          </div>
        </div>
        <div className={styles.box}>
          <strong className={styles.title}>{t('Storage')}</strong>
          <div className={styles.date}>{t('per account')}</div>
          <UsageContainer usage={usage.storage} limit={usage.storageByteLimit}>
            <strong className={styles.description}>{t('Current use')}</strong>
            <strong>{bytesToGigabyteString(usage.storage)}</strong>
            <LimitRow
              limit={bytesToGigabyteString(usage.storageByteLimit)}
              isVisible={usage.storage > 0}
            />
          </UsageContainer>
        </div>
        <div className={styles.box}>
          <strong className={styles.title}>{t('Transcription minutes')}</strong>
          <div className={styles.date}>
            {formatMonth(new Date().toUTCString())}
          </div>
          <UsageContainer usage={usage.monthlyTranscriptionMinutes} limit={usage.nlpMinuteLimit}>
            <strong className={styles.description}>{t('Monthly use')}</strong>
            <strong>{usage.monthlyTranscriptionMinutes}</strong>
            <LimitRow
              limit={usage.nlpMinuteLimit?.toLocaleString()}
              isVisible={usage.monthlyTranscriptionMinutes > 0}
            />
          </UsageContainer>
        </div>
        <div className={styles.box}>
          <strong className={styles.title}>
            {t('Translation characters')}
          </strong>
          <div className={styles.date}>
            {formatMonth(new Date().toUTCString())}
          </div>
          <div className={styles.usage}>
            <strong className={styles.description}>{t('Monthly use')}</strong>
            <strong>{usage.monthlyTranslationChars}</strong>
            <LimitRow
              limit={usage.nlpCharacterLimit?.toLocaleString()}
              isVisible={usage.monthlyTranslationChars > 0}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

interface LimitRowProps {
  limit: number|string|undefined;
  isVisible?: boolean;
}

const LimitRow = ({limit, isVisible=false}: LimitRowProps) => {
  if (!isVisible || !limit || limit === 'unlimited') {
    return null;
  }
  return (
      <>
        <span aria-hidden className={styles.delimiter}>/</span>
        <span className={styles.visuallyHidden}>
          {t('used out of')}
        </span>
        <span>{limit.toLocaleString()}</span>
      </>
  );
};

interface UsageContainerProps {
  children: ReactNode;
  usage: number|string|undefined;
  limit: number|string|undefined;
}

const UsageContainer = ({children, usage, limit}: UsageContainerProps) => {
  let limitRatio = 0;
  if (Number.isInteger(usage) && Number.isInteger(limit) && limit) {
    // @ts-ignore
    limitRatio = usage / limit;
  }
  return (
    <div className={classnames(
      styles.usage,
      {
        [styles.warning]: limitRatio > WARNING_THRESHOLD_RATIO,
        [styles.overlimit]: limitRatio > 1,
      },
    )}>
      {<Icon name={'warning'} size={'l'}/>}
      {children}
    </div>
  );
};
