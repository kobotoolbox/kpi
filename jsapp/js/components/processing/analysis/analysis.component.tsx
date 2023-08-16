import React, {useMemo, useReducer, useState, useEffect} from 'react';
import bodyStyles from '../processingBody.module.scss';
import AnalysisContent from './analysisContent.component';
import {
  initialState,
  analysisQuestionsReducer,
} from './analysisQuestions.reducer';
import AnalysisQuestionsContext from './analysisQuestions.context';
import AnalysisHeader from './analysisHeader.component';
import classNames from 'classnames';
import {
  getAssetAdvancedFeatures,
  getAssetSubmissionProcessingUrl,
} from 'js/assetUtils';
import {
  applyUpdateResponseToInternalQuestions,
  getQuestionsFromSchema,
} from './utils';
import singleProcessingStore from '../singleProcessingStore';
import {fetchGetUrl} from 'js/api';
import LoadingSpinner from 'js/components/common/loadingSpinner';
import type {SubmissionProcessingDataResponse} from './constants';

/**
 * Displays content of the "Analysis" tab. This component is handling all of
 * the Qualitative Analysis functionality.
 */
export default function Analysis() {
  const [isInitialised, setIsInitialised] = useState(false);

  // This is initial setup of reducer that holds all analysis questions with
  // responses.
  const [state, dispatch] = useReducer(analysisQuestionsReducer, initialState);
  const contextValue = useMemo(() => {
    return {state, dispatch};
  }, [state, dispatch]);

  // This loads existing questions definitions and respones to build the actual
  // initial data for the reducer.
  useEffect(() => {
    async function setupQuestions() {
      // Step 1: get advanced features
      // Note: this relies on a dirty-ish HACK in `updateSurveyQuestions()` from
      // '…/processing/analysis/utils.ts' file that updates the `assetStore` that
      // holds the latest advanced features object.
      // Possible TODO: make a call to get asset here - instead of using existing
      // data with a HACK :shrug:
      const advancedFeatures = getAssetAdvancedFeatures(
        singleProcessingStore.currentAssetUid
      );

      // Step 2: build question definitions without responses
      let questions = getQuestionsFromSchema(advancedFeatures);

      // Step 3: get processing url and qpath
      const processingUrl = getAssetSubmissionProcessingUrl(
        singleProcessingStore.currentAssetUid,
        singleProcessingStore.currentSubmissionEditId
      );
      const qpath = singleProcessingStore.currentQuestionQpath;

      // Step 4: get responses for questions and apply them to already built
      // definitions
      try {
        if (processingUrl && qpath) {
          const apiResponse =
            await fetchGetUrl<SubmissionProcessingDataResponse>(processingUrl);

          questions = applyUpdateResponseToInternalQuestions(
            qpath,
            apiResponse,
            questions
          );
        }
      } catch (err) {
        // TODO error handling thank you :o
        console.log('error!', err);
      }

      // Step 5: update reducer
      dispatch({type: 'setQuestions', payload: {questions: questions}});

      // Step 6: hide spinner
      setIsInitialised(true);
    }
    setupQuestions();
  }, []);

  if (!isInitialised) {
    return <LoadingSpinner hideMessage />;
  }

  return (
    <div className={classNames(bodyStyles.root, bodyStyles.viewAnalysis)}>
      <AnalysisQuestionsContext.Provider value={contextValue}>
        <AnalysisHeader />

        <AnalysisContent />
      </AnalysisQuestionsContext.Provider>
    </div>
  );
}
