import {useEffect, useState, useMemo, useReducer} from 'react';
import {getUsageForOrganization} from '../../account/usage.api';
import type {BaseSubscription, BasePrice} from '../../account/stripe.api';
import {getSubscription, getProducts} from '../../account/stripe.api';
import envStore, {FreeTierThresholds} from 'js/envStore';
import {truncateNumber} from 'js/utils';
import {USAGE_WARNING_RATIO} from 'js/constants';

interface UsageState {
  storage: number;
  monthlySubmissions: number;
  yearlySubmissions: number;
  monthlyTranscriptionMinutes: number;
  yearlyTranscriptionMinutes: number;
  monthlyTranslationChars: number;
  yearlyTranslationChars: number;
}

interface SubscribedState {
  subscribedProduct: null | BaseSubscription;
}

const initialState = {
  subscribedProduct: null,
};

function subscriptionReducer(state: SubscribedState, action: {prodData: any}) {
  return {...state, subscribedProduct: action.prodData};
}

export const getAllExceedingLimits = () => {
  const [state, dispatch] = useReducer(subscriptionReducer, initialState);
  const [usage, setUsage] = useState<UsageState>({
    storage: 0,
    monthlySubmissions: 0,
    yearlySubmissions: 0,
    monthlyTranscriptionMinutes: 0,
    yearlyTranscriptionMinutes: 0,
    monthlyTranslationChars: 0,
    yearlyTranslationChars: 0,
  });

  const [exceedList, setExceedList] = useState<string[]>([]);
  const [warningList, setWarningList] = useState<string[]>([]);

  const [subscribedStorageLimit, setSubscribedStorageLimit] = useState<
    number | string
  >();
  const [subscribedSubmissionLimit, setSubscribedSubmissionLimit] = useState<
    number | string
  >();
  const [subscribedTranscriptionMinutes, setTranscriptionMinutes] = useState<
    number | string
  >();
  const [subscribedTranslationChars, setTranslationChars] = useState<
    number | string
  >();

  // Get products and get default limits for community plan
  useMemo(() => {
    getProducts().then((products) => {
      const freeProduct = products.results.find((products) =>
        products.prices.find(
          (price: BasePrice) =>
            price.unit_amount === 0 && price.recurring?.interval === 'month'
        )
      );
      setSubscribedSubmissionLimit(
        Number(freeProduct?.metadata.submission_limit)
      );
      setSubscribedStorageLimit(
        Number(freeProduct?.metadata.storage_bytes_limit)
      );
      setTranscriptionMinutes(Number(freeProduct?.metadata.nlp_seconds_limit));
      setTranslationChars(Number(freeProduct?.metadata.nlp_character_limit));

      type FreeTierThresholdsArray = [keyof FreeTierThresholds, number | null];
      // Check Thresholds
      const thresholds = envStore.data.free_tier_thresholds;
      const thresholdsArray = Object.entries(
        thresholds
      ) as FreeTierThresholdsArray[];
      thresholdsArray.forEach(([key, value]) => {
        if (value && value > 0) {
          setLimitThresholds(key, value);
        }
        if (value && value <= 0) {
          setLimitThresholds(key, 'unlimited');
        }
      });
    });
  }, []);

  // Get subscription data
  useMemo(() => {
    getSubscription().then((data) => {
      dispatch({
        prodData: data.results,
      });
    });
  }, []);

  // Get current usage
  useEffect(() => {
    getUsageForOrganization().then((data) => {
      if (!data) {
        return;
      }
      setUsage({
        ...usage,
        storage: data.total_storage_bytes,
        monthlySubmissions: data.total_submission_count['current_month'],
        yearlySubmissions: data.total_submission_count['current_year'],
        monthlyTranscriptionMinutes: Math.floor(
          truncateNumber(data.total_nlp_usage['asr_seconds_current_month'] / 60)
        ), // seconds to minutes
        yearlyTranscriptionMinutes: Math.floor(
          truncateNumber(data.total_nlp_usage['asr_seconds_current_year'] / 60)
        ),
        monthlyTranslationChars:
          data.total_nlp_usage['mt_characters_current_month'],
        yearlyTranslationChars:
          data.total_nlp_usage['mt_characters_current_year'],
      });
    });
  }, []);

  function setLimitThresholds(
    limitName: keyof FreeTierThresholds,
    limitValue: string | number
  ) {
    const limitMap = {
      storage: 'storage_bytes_limit',
      data: 'submission_limit',
      translation_chars: 'nlp_character_limit',
      transcription_minutes: 'nlp_seconds_limit',
    };
    let limit = limitValue;
    // If user is subscribed to a plan assign limit for that plan
    if (limit === '') {
      const metadataKey = limitMap[limitName];
      limit =
        state.subscribedProduct?.[0].items[0].price.product.metadata[
          metadataKey
        ];
    }

    switch (limitName) {
      case 'storage':
        setSubscribedStorageLimit(limit);
        break;
      case 'data':
        setSubscribedSubmissionLimit(limit);
        break;
      case 'translation_chars':
        setTranslationChars(limit);
        break;
      case 'transcription_minutes':
        setTranscriptionMinutes(limit);
        break;
      default:
        break;
    }
  }

  function isOverLimit(
    subscribedLimit: number | string | undefined,
    currentUsage: number | undefined,
    listString: string
  ) {
    if (
      subscribedLimit &&
      typeof subscribedLimit === 'number' &&
      typeof currentUsage === 'number'
    ) {
      if (currentUsage >= subscribedLimit) {
        setExceedList((prevState) => prevState.concat([listString]));
      } else if (currentUsage >= subscribedLimit * USAGE_WARNING_RATIO) {
        setWarningList((prevState) => prevState.concat([listString]));
      }
    }
  }

  // Check if usage is more than limit
  useMemo(() => {
    // Check yearly vs monthly / community
    let interval;
    if (state.subscribedProduct?.length > 0) {
      interval = state.subscribedProduct?.[0].items[0].price.recurring.interval;
    }
    isOverLimit(subscribedStorageLimit, usage.storage, 'storage');

    // If subscribed plan is month or community plan
    if (interval === 'month' || interval === undefined) {
      isOverLimit(
        subscribedSubmissionLimit,
        usage.monthlySubmissions,
        'submissions'
      );
      isOverLimit(
        subscribedTranscriptionMinutes,
        usage.monthlyTranscriptionMinutes,
        'transcription minutes'
      );
      isOverLimit(
        subscribedTranslationChars,
        usage.monthlyTranslationChars,
        'translation characters'
      );
    }
    // If subscribed plan is year
    if (interval === 'year') {
      isOverLimit(
        subscribedSubmissionLimit,
        usage.yearlySubmissions,
        'submissions'
      );
      isOverLimit(
        subscribedTranscriptionMinutes,
        usage.monthlyTranscriptionMinutes,
        'transcription_minutes'
      );
      isOverLimit(
        subscribedTranslationChars,
        usage.monthlyTranslationChars,
        'translation_chars'
      );
    }
  }, [usage]);
  return {exceedList, warningList};
};

export const getPlanInterval = () => {
  const [state, dispatch] = useReducer(subscriptionReducer, initialState);

  useMemo(() => {
    getSubscription().then((data) => {
      dispatch({
        prodData: data.results,
      });
    });
  }, []);

  let interval;
  if (state.subscribedProduct?.length > 0) {
    return state.subscribedProduct[0].items[0].price.recurring.interval;
  }
  return 'month';
};
