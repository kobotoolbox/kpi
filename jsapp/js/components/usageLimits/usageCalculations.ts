import {useEffect, useState, useMemo, useReducer} from 'react';
import {getUsage} from '../../account/usage.api';
import type {BaseSubscription, BasePrice} from '../../account/stripe.api';
import {getSubscription, getProducts} from '../../account/stripe.api';
import envStore from 'js/envStore';

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

export let exceedList: string[] = [];

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

  function truncate(decimal: number) {
    return parseFloat(decimal.toFixed(2));
  }

  // Get products and get default limits for community plan
  useMemo(() => {
    getProducts().then((products) => {
      const freeProduct = products.results.find((products) =>
        products.prices.find((price: BasePrice) => {
          return (
            price.unit_amount === 0 && price.recurring?.interval === 'month'
          );
        })
      );
      setSubscribedSubmissionLimit(
        Number(freeProduct?.metadata.submission_limit)
      );
      setSubscribedStorageLimit(
        Number(freeProduct?.metadata.storage_bytes_limit)
      );
      setTranscriptionMinutes(Number(freeProduct?.metadata.nlp_seconds_limit));
      setTranslationChars(Number(freeProduct?.metadata.nlp_character_limit));
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
    getUsage().then((data) => {
      setUsage({
        ...usage,
        storage: data.total_storage_bytes,
        monthlySubmissions: data.total_submission_count['current_month'],
        yearlySubmissions: data.total_submission_count['current_year'],
        monthlyTranscriptionMinutes: Math.floor(
          truncate(data.total_nlp_usage['asr_seconds_current_month'] / 60)
        ), // seconds to minutes
        yearlyTranscriptionMinutes: Math.floor(
          truncate(data.total_nlp_usage['asr_seconds_current_year'] / 60)
        ),
        monthlyTranslationChars:
          data.total_nlp_usage['mt_characters_current_month'],
        yearlyTranslationChars:
          data.total_nlp_usage['mt_characters_current_year'],
      });
    });
  }, []);

  function setLimitThresholds(limitName: string, limitValue: string | number) {
    // If user is subscribed to a plan assign limit for that plan
    if (limitValue === '') {
      switch (limitName) {
        case 'storage':
          limitValue =
            state.subscribedProduct?.[0].items[0].price.product.metadata
              .storage_bytes_limit;
          break;
        case 'data':
          limitValue =
            state.subscribedProduct?.[0].items[0].price.product.metadata
              .submission_limit;
          break;
        case 'translation_char':
          limitValue =
            state.subscribedProduct?.[0].items[0].price.product.metadata
              .nlp_character_limit;
          break;
        case 'transcription_minutes':
          limitValue =
            state.subscribedProduct?.[0].items[0].price.product.metadata
              .nlp_seconds_limit;
          break;
        default:
          break;
      }
    }
    switch (limitName) {
      case 'storage':
        setSubscribedStorageLimit(limitValue);
        break;
      case 'data':
        setSubscribedSubmissionLimit(limitValue);
        break;
      case 'translation_char':
        setTranslationChars(limitValue);
        break;
      case 'transcription_minutes':
        setTranscriptionMinutes(limitValue);
        break;
      default:
        break;
    }
  }

  // Check Thresholds
  useMemo(() => {
    const thresholds = envStore.data.free_tier_thresholds;
    Object.entries(thresholds).forEach((entry) => {
      const [key, value] = entry;
      if (value === null) {
        setLimitThresholds(key, '');
        return;
      } else if (value > 0) {
        setLimitThresholds(key, value);
      } else if (value <= 0) {
        setLimitThresholds(key, 'unlimted');
      }
    });
  }, []);

  function isOverLimit(
    subscribedLimit: number | string | undefined,
    currentUsage: number | string | undefined,
    listString: string
  ) {
    if (subscribedLimit && typeof subscribedLimit !== 'string') {
      if (typeof currentUsage === 'number') {
        if (currentUsage > subscribedLimit) {
          exceedList.push(listString);
        }
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
    exceedList = [];
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
        'Transcription Minutes'
      );
      isOverLimit(
        subscribedTranslationChars,
        usage.monthlyTranslationChars,
        'Translation Charaters'
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
        'Transcription Minutes'
      );
      isOverLimit(
        subscribedTranslationChars,
        usage.monthlyTranslationChars,
        'Translation Charaters'
      );
    }
  }, [usage]);
  return exceedList;
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
    interval = state.subscribedProduct?.[0].items[0].price.recurring.interval;
  } else {
    interval = 'month';
  }
  return interval;
};
