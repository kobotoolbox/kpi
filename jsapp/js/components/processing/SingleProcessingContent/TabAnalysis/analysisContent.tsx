import React, { useContext } from 'react'

import singleProcessingStore from '../../singleProcessingStore'
import AnalysisQuestionsList from './AnalysisQuestionsList'
import styles from './analysisContent.module.scss'
import AnalysisContentEmpty from './analysisContentEmpty'
import AnalysisQuestionsContext from './analysisQuestions.context'

/** Displays either a special message for no content, or the list of questions. */
export default function AnalysisContent() {
  const analysisQuestions = useContext(AnalysisQuestionsContext)
  if (!analysisQuestions) {
    return null
  }

  // We only want to display analysis questions for this survey question
  const filteredQuestions = analysisQuestions.state.questions.filter(
    (question) => question.xpath === singleProcessingStore.currentQuestionXpath,
  )

  return (
    <section className={styles.root}>
      {filteredQuestions.length === 0 && <AnalysisContentEmpty />}

      {filteredQuestions.length > 0 && <AnalysisQuestionsList />}
    </section>
  )
}
