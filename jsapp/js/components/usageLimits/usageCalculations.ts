import {useEffect, useState, useMemo, useReducer} from 'react';
import {getUsage} from '../../account/usage.api';
import type {BaseSubscription} from '../../account/stripe.api';
import {getSubscription} from '../../account/stripe.api';

interface UsageState {
  storage: number;
  monthlySubmissions: number;
  monthlyTranscriptionMinutes: number;
  monthlyTranslationChars: number;
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
    monthlyTranscriptionMinutes: 0,
    monthlyTranslationChars: 0,
  });
  const [subscribedStorageLimit, setSubscribedStorageLimit] = useState(1073741824);
  const [subscribedSubmissionLimit, setSubscribedSubmissionLimit] =
    useState(1000);
  const [subscribedTranscriptionMinutes, setTranscriptionMinutes] =
    useState(600);
  const [subscribedTranslationChars, setTranslationChars] = useState(6000);

  useMemo(() => {
    getSubscription().then((data) => {
      dispatch({
        prodData: data.results,
      });
    });
  }, []);

  useEffect(() => {
    getUsage().then((data) => {
      setUsage({
        ...usage,
        storage:data.total_storage_bytes,
        monthlySubmissions: data.total_submission_count['current_month'],
        monthlyTranscriptionMinutes: Math.floor(
          truncate(data.total_nlp_usage['asr_seconds_current_month'] / 60)
        ), // seconds to minutes
        monthlyTranslationChars:
          data.total_nlp_usage['mt_characters_current_month'],
      });
    });
  }, []);

  function truncate(decimal: number) {
    return parseFloat(decimal.toFixed(2));
  }

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

  useMemo(() => {
    console.log(usage.storage,  subscribedStorageLimit )

    exceedList = [];
    if (usage.monthlySubmissions > subscribedSubmissionLimit) {
      exceedList.push(t('submissions'));
    }
    if (usage.storage > subscribedStorageLimit) {
      exceedList.push(t('storage'));
    }

    if (usage.monthlyTranscriptionMinutes > subscribedTranscriptionMinutes) {
      exceedList.push(t('Transcription Minutes'));
    }

    if (usage.monthlyTranslationChars > subscribedTranslationChars) {
      exceedList.push(t('Translation Charaters'));
    }
  }, [usage]);
  return exceedList;
};
