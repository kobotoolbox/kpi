import React, { useState } from 'react'

import singleProcessingStore from '#/components/processing/singleProcessingStore'
import SubmissionDataList from '#/components/submissions/submissionDataList'
import { ADDITIONAL_SUBMISSION_PROPS, META_QUESTION_TYPES } from '#/constants'
import type { AssetResponse } from '#/dataInterface'
import styles from './sidebarSubmissionData.module.scss'

interface SidebarSubmissionDataProps {
  asset: AssetResponse
}

export default function SidebarSubmissionData(props: SidebarSubmissionDataProps) {
  const [store] = useState(() => singleProcessingStore)

  const submissionData = store.getSubmissionData()

  if (!props.asset.content) {
    return null
  }

  // If submission data is not ready yet, just don't render the list.
  if (!submissionData) {
    return null
  }

  /** We want only the processing related data (the actual form questions) */
  function getQuestionsToHide(): string[] {
    const metaQuestions = [
      singleProcessingStore.currentQuestionName || '',
      ...Object.keys(ADDITIONAL_SUBMISSION_PROPS),
      ...Object.keys(META_QUESTION_TYPES),
    ]

    return metaQuestions.concat(store.getHiddenSidebarQuestions())
  }

  return (
    <section className={styles.dataList} key='data-list'>
      <div className={styles.dataListBody}>
        {submissionData && (
          <SubmissionDataList
            asset={props.asset}
            submissionData={submissionData}
            hideQuestions={getQuestionsToHide()}
            hideGroups
          />
        )}
      </div>
    </section>
  )
}
