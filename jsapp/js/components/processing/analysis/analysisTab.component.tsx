import React, {useMemo, useReducer, useState, useEffect} from 'react';
import bodyStyles from 'js/components/processing/processingBody.module.scss';
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
import singleProcessingStore from 'js/components/processing/singleProcessingStore';
import {fetchGetUrl, handleApiFail} from 'js/api';
import LoadingSpinner from 'js/components/common/loadingSpinner';
import InlineMessage from 'js/components/common/inlineMessage';
import type {SubmissionProcessingDataResponse} from './constants';
import type {FailResponse} from 'js/dataInterface';

/**
 * Displays content of the "Analysis" tab. This component is handling all of
 * the Qualitative Analysis functionality.
 */
export default function AnalysisTab() {
  const [isInitialised, setIsInitialised] = useState(false);
  const [isErrored, setIsErrored] = useState(false);

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
      //
      // UPDATE ADVANCED FEATURES HACK (PART 1/2):
      // This relies on a (gray area) HACK that updates the `assetStore` (which
      // holds the latest advanced features object).
      // Possible TODO: make a call to get asset here - instead of using existing
      // data :shrug:
      const advancedFeatures = getAssetAdvancedFeatures(
        singleProcessingStore.currentAssetUid
      );

      // Step 2: build question definitions without responses
      let questions = getQuestionsFromSchema(advancedFeatures);

      // Step 3: get processing url
      const processingUrl = getAssetSubmissionProcessingUrl(
        singleProcessingStore.currentAssetUid,
        singleProcessingStore.currentSubmissionEditId
      );

      // Step 4: get responses for questions and apply them to already built
      // definitions
      try {
        if (processingUrl) {
          const apiResponse =
            await fetchGetUrl<SubmissionProcessingDataResponse>(processingUrl);

          questions = applyUpdateResponseToInternalQuestions(
            singleProcessingStore.currentQuestionXpath,
            apiResponse,
            questions
          );
        }

        // Step 5: update reducer
        dispatch({type: 'setQuestions', payload: {questions: questions}});

        // Step 6: hide spinner
        setIsInitialised(true);
      } catch (err) {
        handleApiFail(err as FailResponse);
        setIsInitialised(true);
        setIsErrored(true);
      }
    }
    setupQuestions();
  }, []);

  useEffect(() => {
    // The singleProcessingStore is handling navigation blocking for the whole
    // single processing route. We need to keep it up to date whether the
    // analysisQuestions.reducer has unsaved changes or not.
    singleProcessingStore.setAnalysisTabHasUnsavedChanges(state.hasUnsavedWork);
  }, [state.hasUnsavedWork]);

  if (!isInitialised) {
    return (
      <div className={bodyStyles.root}>
        <LoadingSpinner message={false} />
      </div>
    );
  }

  if (isErrored) {
    return (
      <div className={bodyStyles.root}>
        <InlineMessage
          type='error'
          message={t('Failed to load analysis questions')}
        />
      </div>
    );
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
