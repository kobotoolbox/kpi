import React, { useMemo } from 'react'

import type { DataResponse } from '#/api/models/dataResponse'
import type { LanguageCode } from '#/components/languages/languagesStore'
import SubmissionDataList from '#/components/submissions/submissionDataList'
import { ADDITIONAL_SUBMISSION_PROPS, META_QUESTION_TYPES } from '#/constants'
import type { AssetResponse } from '#/dataInterface'
import { recordKeys } from '#/utils'
import styles from './sidebarSubmissionData.module.scss'

interface SidebarSubmissionDataProps {
  xpath: string
  asset: AssetResponse
  hiddenQuestions: string[]
  questionLabelLanguage: LanguageCode | string
  submission?: DataResponse
}

export default function SidebarSubmissionData({
  asset,
  xpath,
  hiddenQuestions,
  questionLabelLanguage,
  submission,
}: SidebarSubmissionDataProps) {
  if (!asset.content) {
    return null
  }

  // If submission data is not ready yet, just don't render the list.
  if (!submission) {
    return null
  }

  /** We want only the processing related data (the actual form questions) */
  const questionsToHide = useMemo(() => {
    // The processed question is already shown above this list. `hideQuestions` matches on
    // names, and the last segment of an xpath is the name - no form lookup needed.
    const processedQuestionName = xpath.split('/').at(-1) ?? ''
    const metaQuestions = [
      processedQuestionName,
      ...recordKeys(ADDITIONAL_SUBMISSION_PROPS),
      ...recordKeys(META_QUESTION_TYPES),
    ]

    return metaQuestions.concat(hiddenQuestions)
  }, [xpath, hiddenQuestions])

  return (
    <section className={styles.dataList} key='data-list'>
      <div className={styles.dataListBody}>
        <SubmissionDataList
          asset={asset}
          submission={submission}
          hideQuestions={questionsToHide}
          hideGroups
          questionLabelLanguage={questionLabelLanguage}
        />
      </div>
    </section>
  )
}
