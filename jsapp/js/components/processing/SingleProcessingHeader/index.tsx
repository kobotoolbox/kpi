import React from 'react'

import type { AssetResponse } from '#/dataInterface'
import ButtonReturn from './ButtonReturn'
import SelectQuestion from './SelectQuestion'
import SelectSubmission from './SelectSubmission'
import styles from './index.module.scss'

interface SingleProcessingHeaderProps {
  submissionEditId: string
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
  submissionEditId,
  xpath,
}: SingleProcessingHeaderProps) {
  return (
    <header className={styles.root}>
      <SelectQuestion asset={asset} xpath={xpath} submissionEditId={submissionEditId} />
      <SelectSubmission assetUid={asset.uid} xpath={xpath} submissionEditId={submissionEditId} />
      <ButtonReturn assetUid={asset.uid} />
    </header>
  )
}
