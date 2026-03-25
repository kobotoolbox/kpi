import React from 'react'

import Icon from '#/components/common/icon'
import InlineMessage from '#/components/common/inlineMessage'
import { userCan } from '#/components/permissions/utils'
import type { AssetResponse } from '#/dataInterface'
import styles from './analysisContentEmpty.module.scss'

interface Props {
  asset: AssetResponse
}

/** To be displayed when there are no questions defined yet. */
export default function AnalysisContentEmpty({ asset }: Props) {
  if (userCan('manage_asset', asset)) {
    return (
      <div className={styles.root}>
        <InlineMessage
          icon='alert'
          type='warning'
          message={t(
            'Please note that any qualitative question created for this record will generate a new column in the data table, making the question available for all other records.',
          )}
        />

        <p>{t('There are no qualitative analysis questions yet.')}</p>

        <p>{t('Click the "Add question" button to get started')}</p>
      </div>
    )
  }

  return (
    <div className={styles.root}>
      <p>{t('There are no qualitative analysis questions yet.')}</p>

      <p>
        <Icon name='lock-alt' size='xl' className={styles.lockIcon} />
      </p>

      <p>
        <strong>{t('Only those with full editing rights can create questions')}</strong>
      </p>
      <p>{t('Contact the project owner for more information')}</p>
    </div>
  )
}
