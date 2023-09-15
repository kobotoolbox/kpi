import {useEffect, useState, useMemo, useReducer, useContext} from 'react';
import {getUsageForOrganization} from '../../account/usage.api';
import type {BaseSubscription, BasePrice} from '../../account/stripe.api';
import {getProducts} from '../../account/stripe.api';
import type {FreeTierThresholds} from 'js/envStore';
import envStore from 'js/envStore';
import {truncateNumber} from 'js/utils';
import {USAGE_WARNING_RATIO} from 'js/constants';
import useWhenStripeIsEnabled from 'js/hooks/useWhenStripeIsEnabled.hook';
import {when} from 'mobx';
import subscriptionStore from 'js/account/subscriptionStore';
import {UsageContext} from 'js/account/useUsage.hook';

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

export const useExceedingLimits = () => {
  const [state, dispatch] = useReducer(subscriptionReducer, initialState);
  const usage = useContext(UsageContext);

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
  useWhenStripeIsEnabled(() => {
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
  useWhenStripeIsEnabled(() => {
    return when(
      () => subscriptionStore.isInitialised,
      () => {
        dispatch({
          prodData: subscriptionStore.subscriptionResponse,
        });
      }
    );
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
    isOverLimit(subscribedStorageLimit, usage.storage, 'storage');
    isOverLimit(subscribedSubmissionLimit, usage.submissions, 'submission');
    isOverLimit(
      subscribedTranscriptionMinutes,
      usage.transcriptionMinutes,
      'automated transcription'
    );
    isOverLimit(
      subscribedTranslationChars,
      usage.translationChars,
      'machine translation'
    );
  }, [usage]);

  return {exceedList, warningList};
};
