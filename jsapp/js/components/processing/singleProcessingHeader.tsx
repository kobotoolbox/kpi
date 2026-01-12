import React from 'react'
import type { AssetResponse } from '#/dataInterface'
import styles from './singleProcessingHeader.module.scss'
import SingleProcessingHeaderButton from './singleProcessingHeaderButton'
import SingleProcessingHeaderSelectQuestion from './singleProcessingHeaderSelectQuestion'
import SingleProcessingHeaderSelectSubmission from './singleProcessingHeaderSelectSubmission'

interface SingleProcessingHeaderProps {
  submissionEditId: string
  assetUid: string
  asset: AssetResponse
  xpath: string
}

/**
 * Component with the current question label and the UI for switching between
 * submissions and questions. It also has means of leaving Single Processing
 * via "DONE" button.
 */
export default function SingleProcessingHeader({
  asset,
  assetUid,
  submissionEditId,
  xpath,
}: SingleProcessingHeaderProps) {
  return (
    <header className={styles.root}>
      <SingleProcessingHeaderSelectQuestion
        assetUid={assetUid}
        xpath={xpath}
        submissionEditId={submissionEditId}
        asset={asset}
      />
      <SingleProcessingHeaderSelectSubmission assetUid={assetUid} xpath={xpath} submissionEditId={submissionEditId} />
      <SingleProcessingHeaderButton assetUid={assetUid} />
    </header>
  )
}
