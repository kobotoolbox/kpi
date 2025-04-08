import React, { useState } from 'react'

import { getActiveTab } from '#/components/processing/routes.utils'
import SidebarDisplaySettings from '#/components/processing/sidebar/sidebarDisplaySettings'
import SidebarSubmissionData from '#/components/processing/sidebar/sidebarSubmissionData'
import SidebarSubmissionMedia from '#/components/processing/sidebar/sidebarSubmissionMedia'
import singleProcessingStore, { StaticDisplays } from '#/components/processing/singleProcessingStore'
import type { AssetResponse } from '#/dataInterface'
import styles from './processingSidebar.module.scss'
import TransxDisplay from './transxDisplay'

interface ProcessingSidebarProps {
  asset: AssetResponse
}

export default function ProcessingSidebar(props: ProcessingSidebarProps) {
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

        {displays.includes(StaticDisplays.Audio) && <SidebarSubmissionMedia asset={props.asset} />}

        {displays.includes(StaticDisplays.Data) && <SidebarSubmissionData asset={props.asset} />}

        {displays.length === 0 && (
          <div className={styles.emptyMessage}>
            {t('Use the button above to select the information to be displayed in this area')}
          </div>
        )}
      </div>
    </div>
  )
}
