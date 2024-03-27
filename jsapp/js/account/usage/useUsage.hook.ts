import {createContext, useEffect, useState} from 'react';
import type {Organization, RecurringInterval} from 'js/account/stripe.types';
import {getSubscriptionInterval} from 'js/account/stripe.api';
import {formatRelativeTime, truncateNumber} from 'js/utils';
import {getUsage} from 'js/account/usage/usage.api';
import {
  useApiFetcher,
  withApiFetcher,
  WithApiFetcher,
} from 'js/hooks/useApiFetcher.hook';

export interface UsageState {
  storage: number;
  submissions: number;
  transcriptionMinutes: number;
  translationChars: number;
  currentMonthStart: string;
  currentYearStart: string;
  billingPeriodEnd: string | null;
  trackingPeriod: RecurringInterval;
  lastUpdated?: String | null;
  isLoaded: boolean;
}

const INITIAL_USAGE_STATE: UsageState = Object.freeze({
  storage: 0,
  submissions: 0,
  transcriptionMinutes: 0,
  translationChars: 0,
  currentMonthStart: '',
  currentYearStart: '',
  billingPeriodEnd: null,
  trackingPeriod: 'month',
  lastUpdated: '',
  isLoaded: false,
});

const loadUsage = async (
  organization: Organization
): Promise<UsageState | undefined> => {
  if (!organization?.id) {
    return;
  }
  const trackingPeriod = await getSubscriptionInterval();
  const usage = await getUsage(organization.id);
  if (!usage) {
    return;
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
    submissions: usage.total_submission_count[`current_${trackingPeriod}`],
    transcriptionMinutes: Math.floor(
      truncateNumber(
        usage.total_nlp_usage[`asr_seconds_current_${trackingPeriod}`] / 60
      )
    ), // seconds to minutes
    translationChars:
      usage.total_nlp_usage[`mt_characters_current_${trackingPeriod}`],
    currentMonthStart: usage.current_month_start,
    currentYearStart: usage.current_year_start,
    billingPeriodEnd: usage.billing_period_end,
    trackingPeriod,
    lastUpdated,
    isLoaded: true,
  };
};

export const useUsage = (organization: Organization) =>
  useApiFetcher(loadUsage.bind(null, organization), INITIAL_USAGE_STATE);

export const UsageContext = createContext(withApiFetcher(INITIAL_USAGE_STATE));
