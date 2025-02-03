import {createContext} from 'react';
import type {RecurringInterval} from 'js/account/stripe.types';
import {getSubscriptionInterval} from 'js/account/stripe.api';
import {convertSecondsToMinutes, formatRelativeTime} from 'js/utils';
import {getOrgServiceUsage} from 'js/account/usage/usage.api';
import {useApiFetcher, withApiFetcher} from 'js/hooks/useApiFetcher.hook';

export interface UsageState {
  storage: number;
  submissions: number;
  transcriptionMinutes: number;
  translationChars: number;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  trackingPeriod: RecurringInterval;
  lastUpdated?: String | null;
}

const INITIAL_USAGE_STATE: UsageState = Object.freeze({
  storage: 0,
  submissions: 0,
  transcriptionMinutes: 0,
  translationChars: 0,
  currentPeriodStart: '',
  currentPeriodEnd: '',
  trackingPeriod: 'month',
  lastUpdated: '',
});

const loadUsage = async (
  organizationId: string | null
): Promise<UsageState | undefined> => {
  if (!organizationId) {
    throw Error(t('No organization found'));
  }
  const trackingPeriod = await getSubscriptionInterval();
  const usage = await getOrgServiceUsage(organizationId);
  if (!usage) {
    throw Error(t("Couldn't get usage data"));
  }
  let lastUpdated: UsageState['lastUpdated'] = null;
  if ('headers' in usage && usage.headers instanceof Headers) {
    const lastUpdateDate = usage.headers.get('date');
    if (lastUpdateDate) {
      lastUpdated = formatRelativeTime(lastUpdateDate);
    }
  }
  return {
    storage: usage.total_storage_bytes,
    submissions: usage.total_submission_count.current_period,
    transcriptionMinutes: convertSecondsToMinutes(
      usage.total_nlp_usage.asr_seconds_current_period
    ),
    translationChars:
      usage.total_nlp_usage.mt_characters_current_period,
    currentPeriodStart: usage.current_period_start,
    currentPeriodEnd: usage.current_period_end,
    trackingPeriod,
    lastUpdated,
  };
};

export const useUsage = (organizationId: string | null) => {
  const fetcher = useApiFetcher(
    () => {
      return loadUsage(organizationId);
    },
    INITIAL_USAGE_STATE,
    {
      reloadEverySeconds: 15 * 60,
      skipInitialLoad: !organizationId,
    }
  );

  return fetcher;
};
export const UsageContext = createContext(withApiFetcher(INITIAL_USAGE_STATE));
