import React, { useContext } from 'react'

import type { DataResponse } from '#/api/models/dataResponse'
import type { AssetResponse } from '#/dataInterface'
import AnalysisQuestionsContext from '../common/analysisQuestions.context'
import AnalysisQuestionsList from './AnalysisQuestionsList'
import AnalysisContentEmpty from './analysisContentEmpty'
import styles from './index.module.scss'

interface Props {
  asset: AssetResponse
  questionXpath: string
  submission: DataResponse & Record<string, string>
}

/** Displays either a special message for no content, or the list of questions. */
export default function AnalysisContent({ asset, questionXpath, submission }: Props) {
  const analysisQuestions = useContext(AnalysisQuestionsContext)
  if (!analysisQuestions) {
    return null
  }

  // We only want to display analysis questions for this survey question
  const filteredQuestions = analysisQuestions.state.questions.filter((question) => question.xpath === questionXpath)

  return (
    <section className={styles.root}>
      {filteredQuestions.length === 0 && <AnalysisContentEmpty asset={asset} />}

      {filteredQuestions.length > 0 && (
        <AnalysisQuestionsList asset={asset} questionXpath={questionXpath} submission={submission} />
      )}
    </section>
  )
}
