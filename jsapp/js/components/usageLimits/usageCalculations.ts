import {useEffect, useState, useMemo, useReducer} from 'react';
import {getUsage} from '../../account/usage.api';
import type {BaseSubscription, BasePrice} from '../../account/stripe.api';
import {getSubscription, getProducts} from '../../account/stripe.api';

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

  const [subscribedStorageLimit, setSubscribedStorageLimit] =
    useState<number>();
  const [subscribedSubmissionLimit, setSubscribedSubmissionLimit] =
    useState<number>();
  const [subscribedTranscriptionMinutes, setTranscriptionMinutes] =
    useState<number>();
  const [subscribedTranslationChars, setTranslationChars] = useState<number>();

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

  // If user is subscribed to a plan assign limit for that plan
  useMemo(() => {
    if (state.subscribedProduct?.length > 0) {
      setSubscribedSubmissionLimit(
        state.subscribedProduct?.[0].items[0].price.product.metadata
          .submission_limit
      );
      setSubscribedStorageLimit(
        state.subscribedProduct?.[0].items[0].price.product.metadata
          .storage_bytes_limit
      );
      setTranscriptionMinutes(
        state.subscribedProduct?.[0].items[0].price.product.metadata
          .nlp_seconds_limit
      );
      setTranslationChars(
        state.subscribedProduct?.[0].items[0].price.product.metadata
          .nlp_character_limit
      );
    }
  }, [state.subscribedProduct]);

  // Check if usage is more than limit
  useMemo(() => {
    // Check yearly vs monthly / community
    let interval;
    if (state.subscribedProduct?.length > 0) {
      interval = state.subscribedProduct?.[0].items[0].price.recurring.interval;
    }
    exceedList = [];

    if (subscribedStorageLimit) {
      if (usage.storage > subscribedStorageLimit) {
        exceedList.push(t('storage'));
      }
    }
    // If subscribed plan is month or community plan
    if (interval === 'month' || interval === undefined) {
      if (subscribedSubmissionLimit) {
        if (usage.monthlySubmissions > subscribedSubmissionLimit) {
          exceedList.push(t('submissions'));
        }
      }
      if (subscribedTranscriptionMinutes) {
        if (
          usage.monthlyTranscriptionMinutes > subscribedTranscriptionMinutes
        ) {
          exceedList.push(t('Transcription Minutes'));
        }
      }
      if (subscribedTranslationChars) {
        if (usage.monthlyTranslationChars > subscribedTranslationChars) {
          exceedList.push(t('Translation Charaters'));
        }
      }
    }
    // If subscribed plan is year
    if (interval === 'year') {
      if (subscribedSubmissionLimit) {
        if (usage.yearlySubmissions > subscribedSubmissionLimit) {
          exceedList.push(t('submissions'));
        }
      }
      if (subscribedTranscriptionMinutes) {
        if (usage.yearlyTranscriptionMinutes > subscribedTranscriptionMinutes) {
          exceedList.push(t('Transcription Minutes'));
        }
      }
      if (subscribedTranslationChars) {
        if (usage.yearlyTranslationChars > subscribedTranslationChars) {
          exceedList.push(t('Translation Charaters'));
        }
      }
    }
  }, [usage]);
  return exceedList;
};
