import {createContext, useEffect, useState} from 'react';
import type {RecurringInterval} from 'js/account/stripe.api';
import {getSubscriptionInterval} from 'js/account/stripe.api';
import {truncateNumber} from 'js/utils';
import {getUsageForOrganization} from 'js/account/usage.api';

export interface UsageState {
  storage: number;
  submissions: number;
  transcriptionMinutes: number;
  translationChars: number;
  currentMonthStart: string;
  currentYearStart: string;
  trackingPeriod: RecurringInterval;
  isPeriodLoaded: boolean;
  isLoaded: boolean;
}

export function useUsage() {
  const [usage, setUsage] = useState<UsageState>({
    storage: 0,
    submissions: 0,
    transcriptionMinutes: 0,
    translationChars: 0,
    currentMonthStart: '',
    currentYearStart: '',
    trackingPeriod: 'month',
    isPeriodLoaded: false,
    isLoaded: false,
  });

  // get subscription interval (monthly, yearly) from the subscriptionStore when ready
  useEffect(() => {
    getSubscriptionInterval().then((subscriptionInterval) => {
      setUsage((prevState) => {
        return {
          ...prevState,
          trackingPeriod: subscriptionInterval || 'month',
          isPeriodLoaded: true,
        };
      });
    });
  }, []);

  useEffect(() => {
    if (!usage.isPeriodLoaded) {
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
          isLoaded: true,
        };
      });
    });
  }, [usage.isPeriodLoaded]);

  return usage;
}

export const UsageContext = createContext<UsageState>({
  storage: 0,
  submissions: 0,
  transcriptionMinutes: 0,
  translationChars: 0,
  currentMonthStart: '',
  currentYearStart: '',
  trackingPeriod: 'month',
  isPeriodLoaded: false,
  isLoaded: false,
});
