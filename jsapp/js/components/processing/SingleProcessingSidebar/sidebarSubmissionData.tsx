import React, { useMemo } from 'react'

import type { DataResponse } from '#/api/models/dataResponse'
import { getRowNameByXpath } from '#/assetUtils'
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
  currentSubmission: (DataResponse & Record<string, string>) | null
}

export default function SidebarSubmissionData({
  asset,
  xpath,
  hiddenQuestions,
  questionLabelLanguage,
  currentSubmission,
}: SidebarSubmissionDataProps) {
  const submissionData = currentSubmission

  if (!asset.content) {
    return null
  }

  // If submission data is not ready yet, just don't render the list.
  if (!submissionData) {
    return null
  }

  /** We want only the processing related data (the actual form questions) */
  const questionsToHide = useMemo(() => {
    const metaQuestions = [
      getRowNameByXpath(asset.content!, xpath) || '',
      ...recordKeys(ADDITIONAL_SUBMISSION_PROPS),
      ...recordKeys(META_QUESTION_TYPES),
    ]

    return metaQuestions.concat(hiddenQuestions)
  }, [asset, xpath, hiddenQuestions])

  return (
    <section className={styles.dataList} key='data-list'>
      <div className={styles.dataListBody}>
        <SubmissionDataList
          asset={asset}
          submissionData={submissionData}
          hideQuestions={questionsToHide}
          hideGroups
          questionLabelLanguage={questionLabelLanguage}
        />
      </div>
    </section>
  )
}
