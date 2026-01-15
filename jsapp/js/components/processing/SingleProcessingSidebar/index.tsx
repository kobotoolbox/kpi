import React, { useEffect, useState } from 'react'

import type { AssetResponse } from '#/dataInterface'
import { getActiveTab } from '../routes.utils'
import singleProcessingStore, { StaticDisplays, type DisplaysList } from '../singleProcessingStore'
import styles from './index.module.scss'
import SidebarDisplaySettings from './sidebarDisplaySettings'
import SidebarSubmissionData from './sidebarSubmissionData'
import SidebarSubmissionMedia from './sidebarSubmissionMedia'
import TransxDisplay from './transxDisplay'

interface ProcessingSidebarProps {
  xpath: string
  submissionId: string
  asset: AssetResponse
}

export default function ProcessingSidebar({ asset, submissionId, xpath }: ProcessingSidebarProps) {
  const [store] = useState(() => singleProcessingStore)

  const activeTab = getActiveTab()

  if (activeTab === undefined) {
    return null
  }

  // These next states are set from settings in `SidebarDisplaySettings`.
  const [selectedDisplays, setSelectedDisplays] = useState<DisplaysList>([])
  const [hiddenQuestions, setHiddenQuestions] = useState<string[]>([])

  // Every time user changes the tab, we need to load the stored displays list
  // for that tab.
  useEffect(() => {
    //TODO: Move this out of store. This is only using the default values for displays based on activeTab
    setSelectedDisplays(store.getDisplays(activeTab))
  }, [activeTab])

  // TODO: query via react-query and orval
  const translations = store.getTranslations()
  const transcript = store.getTranscript()

  return (
    <div className={styles.root}>
      <SidebarDisplaySettings
        selectedDisplays={selectedDisplays}
        setSelectedDisplays={setSelectedDisplays}
        hiddenQuestions={hiddenQuestions}
        setHiddenQuestions={setHiddenQuestions}
      />
      <div className={styles.displays}>
        {Array.from(translations).map((translation) => {
          if (selectedDisplays.includes(translation.languageCode)) {
            return <TransxDisplay transx={translation} key={translation.languageCode} />
          }

          return null
        })}

        {selectedDisplays.includes(StaticDisplays.Transcript) && transcript && <TransxDisplay transx={transcript} />}

        {selectedDisplays.includes(StaticDisplays.Audio) && (
          <SidebarSubmissionMedia submissionId={submissionId} asset={asset} xpath={xpath} />
        )}

        {selectedDisplays.includes(StaticDisplays.Data) && (
          <SidebarSubmissionData
            submissionId={submissionId}
            asset={asset}
            xpath={xpath}
            hiddenQuestions={hiddenQuestions}
          />
        )}

        {selectedDisplays.length === 0 && (
          <div className={styles.emptyMessage}>
            {t('Use the button above to select the information to be displayed in this area')}
          </div>
        )}
      </div>
    </div>
  )
}
