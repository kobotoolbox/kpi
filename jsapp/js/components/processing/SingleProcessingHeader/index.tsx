import React from 'react'

import type { DataResponse } from '#/api/models/dataResponse'
import type { LanguageCode } from '#/components/languages/languagesStore'
import type { AssetResponse } from '#/dataInterface'
import { removeDefaultUuidPrefix } from '#/utils'
import ButtonReturn from './ButtonReturn'
import SelectQuestion from './SelectQuestion'
import SelectSubmission from './SelectSubmission'
import styles from './index.module.scss'

interface SingleProcessingHeaderProps {
  asset: AssetResponse
  submission: DataResponse
  currentSubmissionUid: string
  questionLabelLanguage: LanguageCode | string
  xpath: string
  hasUnsavedWork: boolean
}

/**
 * Component with the current question label and the UI for switching between
 * submissions and questions. It also has means of leaving Single Processing
 * via "DONE" button.
 */
export default function SingleProcessingHeader({
  asset,
  submission,
  questionLabelLanguage,
  xpath,
  hasUnsavedWork,
}: SingleProcessingHeaderProps) {
  return (
    <header className={styles.root}>
      <SelectQuestion
        asset={asset}
        xpath={xpath}
        currentSubmissionUid={removeDefaultUuidPrefix(submission['meta/rootUuid'])}
        questionLabelLanguage={questionLabelLanguage}
        hasUnsavedWork={hasUnsavedWork}
      />
      <SelectSubmission assetUid={asset.uid} xpath={xpath} submission={submission} hasUnsavedWork={hasUnsavedWork} />
      <ButtonReturn assetUid={asset.uid} hasUnsavedWork={hasUnsavedWork} />
    </header>
  )
}
