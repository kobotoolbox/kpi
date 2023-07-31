import React, {useMemo, useReducer} from 'react';
import bodyStyles from './processingBody.module.scss';
import AnalysisContent from './analysis/analysisContent.component';
import {
  initialState,
  analysisQuestionsReducer,
} from './analysis/analysisQuestions.reducer';
import AnalysisQuestionsContext from './analysis/analysisQuestions.context';
import AnalysisHeader from './analysis/analysisHeader.component';
import classNames from 'classnames';
import {getAssetAdvancedFeatures} from 'js/assetUtils';
import {getQuestionsFromSchema} from './analysis/utils';
import singleProcessingStore from './singleProcessingStore';

export default function AnalysisTabContent() {
  const advancedFeatures = getAssetAdvancedFeatures(
    singleProcessingStore.currentAssetUid
  );

  // We load existing question definitions from asset
  const [state, dispatch] = useReducer(analysisQuestionsReducer, {
    ...initialState,
    // TODO: these questions would need some existing responses from the
    // advanced_submission_post endpoint.
    questions: getQuestionsFromSchema(advancedFeatures),
  });
  const contextValue = useMemo(() => {
    return {state, dispatch};
  }, [state, dispatch]);

  return (
    <div className={classNames(bodyStyles.root, bodyStyles.viewAnalysis)}>
      <AnalysisQuestionsContext.Provider value={contextValue}>
        <AnalysisHeader />

        <AnalysisContent />
      </AnalysisQuestionsContext.Provider>
    </div>
  );
}
