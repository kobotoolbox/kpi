import React, {useEffect, useMemo, useState} from 'react';
import styles from './usage.module.scss';
import {getUsage} from './usage.api';
import {AccountLimit, getAccountLimits, getOrganization, RecurringInterval} from "js/account/stripe.api";
import envStore from 'js/envStore';
import {when} from "mobx";
import {ACTIVE_STRIPE_STATUSES} from "js/constants";
import classnames from "classnames";
import Icon from "js/components/common/icon";
import subscriptionStore, {SubscriptionInfo} from "js/account/subscriptionStore";
import {useLocation} from "react-router-dom";
import prettyBytes from "pretty-bytes";
import moment from "moment/moment";
import LoadingSpinner from "js/components/common/loadingSpinner";

interface UsageState {
  storage: number;
  submissions: number;
  transcriptionMinutes: number;
  translationChars: number;
  storageByteLimit: number|'unlimited';
  nlpCharacterLimit: number|'unlimited';
  nlpMinuteLimit: number|'unlimited';
  submissionLimit: number|'unlimited';
  trackingPeriod: RecurringInterval;
  currentMonthStart: string;
  currentYearStart: string;
  loaded: {
    usage: boolean;
    limits: boolean;
    subscription: boolean;
  };
}

const WARNING_THRESHOLD_RATIO = 0.8;

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
    trackingPeriod: RecurringInterval.Month,
    currentMonthStart: '',
    currentYearStart: '',
    loaded: {
      usage: false,
      limits: false,
      subscription: false,
    },
  });

  const location = useLocation();

  const truncate = (decimal: number) => {
    return parseFloat(decimal.toFixed(2));
  };

  const formatDate = (dateString: string) => {
    const myMoment = moment.utc(dateString);
    return myMoment.format('ll');
  };

  const dateRange = useMemo(() => {
    let startDate: string;
    const endDate = formatDate(new Date().toUTCString());
    switch (usage.trackingPeriod) {
      case RecurringInterval.Year:
        startDate = usage.currentYearStart;
        break;
      default:
        startDate = usage.currentMonthStart;
        break;
    }
    return t('##start_date## to ##end_date##').replace(
      '##start_date##',
      startDate
    ).replace(
      '##end_date##',
      endDate
    );
  }, [usage.currentYearStart, usage.currentMonthStart, usage.trackingPeriod]);

  useEffect(() => {
    const getLimits = async () => {
      await when(() => envStore.isReady);
      let limits: AccountLimit;
      if (envStore.data.stripe_public_key) {
        limits = await getAccountLimits();
      } else {
        return;
      }

      setUsage((prevState) => {
          return {
            ...prevState,
            storageByteLimit: limits.storage_bytes_limit,
            nlpCharacterLimit: limits.nlp_character_limit,
            nlpMinuteLimit: typeof limits.nlp_seconds_limit === 'number' ?
              limits.nlp_seconds_limit / 60 :
              limits.nlp_seconds_limit,
            submissionLimit: limits.submission_limit,
            loaded: {
              ...prevState.loaded,
              limits: true,
            },
          };
      });
    };

    getLimits();
  }, []);

  // get subscription interval (monthly, yearly) from the subscriptionStore when ready
  useEffect(() => {
    if (envStore.isReady && envStore.data.stripe_public_key && subscriptionStore.isLoaded) {
      const subscriptionList: SubscriptionInfo[] = subscriptionStore.subscriptionResponse;
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
          trackingPeriod: subscriptionInterval || RecurringInterval.Month,
          loaded: {
            ...prevState.loaded,
            subscription: true,
          },
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
    if (!usage.loaded.subscription) {
      return;
    }
    const getUsageForOrganization = async () => {
      const organizations = await getOrganization();
      const data = await getUsage(organizations.results?.[0].id);

      setUsage((prevState) => {
        return {
          ...prevState,
          storage: data.total_storage_bytes,
          submissions: data.total_submission_count[`current_${usage.trackingPeriod}`],
          transcriptionMinutes: Math.floor(
            truncate(data.total_nlp_usage[`asr_seconds_current_${usage.trackingPeriod}`] / 60)
          ), // seconds to minutes
          translationChars:
            data.total_nlp_usage[`mt_characters_current_${usage.trackingPeriod}`],
          currentMonthStart: formatDate(data.current_month_start),
          currentYearStart: formatDate(data.current_year_start),
          loaded: {
            ...prevState.loaded,
            usage: true,
          },
        }
      });
    };
    getUsageForOrganization();
  }, [location, usage.loaded.subscription]);

  if (Object.values(usage.loaded).includes(false)) {
    return <LoadingSpinner/>;
  }

  return (
    <div className={styles.root}>
      <h2>{t('Your account total use')}</h2>

      <div className={styles.row}>
        <div className={styles.box}>
          <strong className={styles.title}>{t('Submissions')}</strong>
          <div className={styles.date}>
            {dateRange}
          </div>
          <UsageContainer
            usage={usage.submissions}
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
            label={t('Total')}
            isStorage
          />
        </div>
        <div className={styles.box}>
          <strong className={styles.title}>{t('Transcription minutes')}</strong>
          <div className={styles.date}>
            {dateRange}
          </div>
          <UsageContainer
            usage={usage.transcriptionMinutes}
            limit={usage.nlpMinuteLimit}
            period={usage.trackingPeriod}
          />
        </div>
        <div className={styles.box}>
          <strong className={styles.title}>
            {t('Translation characters')}
          </strong>
          <div className={styles.date}>
            {dateRange}
          </div>
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

interface UsageContainerProps {
  usage: number;
  limit: number|'unlimited';
  label?: string;
  isStorage?: boolean;
  period: RecurringInterval;
}

const UsageContainer = ({
  usage, limit, period, label = undefined, isStorage = false,
}: UsageContainerProps) => {
  let limitRatio = 0;
  if (limit !== 'unlimited' && limit) {
    limitRatio = usage / limit;
  }
  const isOverLimit = limitRatio > 1;
  const isNearingLimit = !isOverLimit && limitRatio > WARNING_THRESHOLD_RATIO;
  return (
    <div className={styles.usage}>
        <strong className={styles.description}>
          {label ||
            (period === 'month' ? t('Monthly') : t('Yearly'))
          }
        </strong>
      {!usage && <span>-</span>}
      {Boolean(usage) && (
        <div className={classnames(styles.usageRow,
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
          <strong>{isStorage ? prettyBytes(usage) : usage.toLocaleString()}</strong>
          {(limit !== 'unlimited' && limit) &&
            <>
              <span aria-hidden> / </span>
              <span className={styles.visuallyHidden}>
                {t('used out of')}
              </span>
              <span>{isStorage ? prettyBytes(limit) : limit.toLocaleString()}</span>
            </>
          }
        </div>
      )}
    </div>
  );
};
