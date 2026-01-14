import React, { useState } from 'react'

import type { AssetResponse } from '#/dataInterface'
import { getActiveTab } from '../routes.utils'
import singleProcessingStore, { StaticDisplays } from '../singleProcessingStore'
import styles from './index.module.scss'
import SidebarDisplaySettings from './sidebarDisplaySettings'
import SidebarSubmissionData from './sidebarSubmissionData'
import SidebarSubmissionMedia from './sidebarSubmissionMedia'
import TransxDisplay from './transxDisplay'

interface ProcessingSidebarProps {
  submissionId: string
  asset: AssetResponse
}

export default function ProcessingSidebar({ asset, submissionId }: ProcessingSidebarProps) {
  const [store] = useState(() => singleProcessingStore)

  const displays = store.getDisplays(getActiveTab())
  const translations = store.getTranslations()
  const transcript = store.getTranscript()

  return (
    <div className={styles.root}>
      <SidebarDisplaySettings />

      <div className={styles.displays}>
        {Array.from(translations).map((translation) => {
          if (displays.includes(translation.languageCode)) {
            return <TransxDisplay transx={translation} key={translation.languageCode} />
          }

          return null
        })}

        {displays.includes(StaticDisplays.Transcript) && transcript && <TransxDisplay transx={transcript} />}

        {displays.includes(StaticDisplays.Audio) && (
          <SidebarSubmissionMedia submissionId={submissionId} asset={asset} xpath={xpath} />
        )}

        {displays.includes(StaticDisplays.Data) && <SidebarSubmissionData asset={asset} />}

        {displays.length === 0 && (
          <div className={styles.emptyMessage}>
            {t('Use the button above to select the information to be displayed in this area')}
          </div>
        )}
      </div>
    </div>
  )
}
