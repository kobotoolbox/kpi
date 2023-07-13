import React, {useContext} from 'react';
import AnalysisQuestionsContext from './analysisQuestions.context';
import AnalysisContentEmpty from './analysisContentEmpty.component';
import AnalysisQuestionsList from './list/analysisQuestionsList.component';
import styles from './analysisContent.module.scss';
import { _getActiveAssetAdvancedFeatures } from 'jsapp/js/stores/AssetAdvancedFeaturesStore';

export default function AnalysisContent() {
  const analysisQuestions = useContext(AnalysisQuestionsContext);

  // const isEmpty = analysisQuestions?.state.questions.length === 0;

  const analysisQuestionsStore = _getActiveAssetAdvancedFeatures();
  const urlHashParts = [...window.location.hash.split('/')].reverse();
  const [ submissionUuid, qpath ] = urlHashParts;
  const isEmpty = analysisQuestionsStore.qualQuestions.qualSurveyForQpath(qpath).length === 0;

  if (!analysisQuestions) {
    return null;
  }

  return (
    <section className={styles.root}>
      { isEmpty ? (
        <AnalysisContentEmpty />
      ) : (
        <AnalysisQuestionsList />
      ) }
    </section>
  );
}
