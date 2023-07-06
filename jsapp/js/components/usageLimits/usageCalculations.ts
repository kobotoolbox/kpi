import React, {useEffect, useState, useMemo, useReducer} from 'react';
import {getUsage} from '../../account/usage.api';
import type {BaseSubscription} from '../../account/stripe.api';
import {getSubscription} from '../../account/stripe.api';

interface UsageState {
  storage: number;
  monthlySubmissions: number;
  transcriptionMinutes: number;
  translationChars: number;
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

const exceedList: string[] = [];

export const  getAllExceedingLimits = () => {
    const [state, dispatch] = useReducer(subscriptionReducer, initialState);
    const [usage, setUsage] = useState<UsageState>({
      storage: 0,
      monthlySubmissions: 0,
      transcriptionMinutes: 0,
      translationChars: 0,
    });
    
    const [subscribedStorageLimit, setSubscribedStorageLimit] = useState(1);
    const [subscribedSubmissionLimit, setSubscribedSubmissionLimit] =
      useState(1000);
    const [subscribedTranscriptionMinutes, setTranscriptionMinutes] =
      useState(600);
    const [subscribedTranslationChars, setTranslationChars] = useState(6000);

  // TODO: Current limits with default to community plan values
  // Should discuss this or check up on defaulting
  // also check the whole minute / seconds thing

  useMemo(() => {
    getSubscription().then((data) => {
      dispatch({
        prodData: data.results,
      });
    });
  }, []);

  function truncate(decimal: number) {
    return parseFloat(decimal.toFixed(2));
  }

  useEffect(() => {
    getUsage().then((data) => {
      setUsage({
        ...usage,
        storage: truncate(data.total_storage_bytes / 1000000000), // bytes to GB
        monthlySubmissions: data.total_submission_count_current_month,
        transcriptionMinutes: Math.floor(
          truncate(data.total_nlp_asr_seconds / 60)
        ), // seconds to minutes
        translationChars: data.total_nlp_mt_characters,
      });
    });
  }, []);

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
  }, []);

  useEffect(() => {
    if (usage.monthlySubmissions > subscribedSubmissionLimit) {
      exceedList.push('submissions');
    }

    if (usage.storage > subscribedStorageLimit) {
      exceedList.push('storage');
    }

    if (usage.transcriptionMinutes > subscribedTranscriptionMinutes) {
      exceedList.push('Transcription Minutes');
    }

    if (usage.translationChars > subscribedTranslationChars) {
      exceedList.push('Translation Charaters');
    }
  });

  return exceedList;
};

// Check if any limits have been exceeded and return boolean
export const checkLimits = ():boolean => {
  if(exceedList.length > 0){
  return true;
  } else {
      return false
  }
};
