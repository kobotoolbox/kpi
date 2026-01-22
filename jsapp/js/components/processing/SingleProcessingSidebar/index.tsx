import React, { useEffect, useMemo, useState } from 'react'

import type { DataResponse } from '#/api/models/dataResponse'
import type { DataSupplementResponse } from '#/api/models/dataSupplementResponse'
import type { LanguageCode } from '#/components/languages/languagesStore'
import type { AssetResponse } from '#/dataInterface'
import { getAllTranslationsFromSupplementData, getLatestTranscriptVersionItem } from '../common/utils'
import { getActiveTab } from '../routes.utils'
import singleProcessingStore, { StaticDisplays, type DisplaysList } from '../singleProcessingStore'
import styles from './index.module.scss'
import SidebarDisplaySettings from './sidebarDisplaySettings'
import SidebarSubmissionData from './sidebarSubmissionData'
import SidebarSubmissionMedia from './sidebarSubmissionMedia'
import TransxDisplay from './transxDisplay'

interface ProcessingSidebarProps {
  questionXpath: string
  asset: AssetResponse
  questionLabelLanguage: LanguageCode | string
  setQuestionLabelLanguage: (LanguageCode: LanguageCode | string) => void
  submission?: DataResponse & Record<string, string>
  supplement: DataSupplementResponse
}

export default function ProcessingSidebar({
  asset,
  questionXpath,
  questionLabelLanguage,
  setQuestionLabelLanguage,
  submission,
  supplement,
}: ProcessingSidebarProps) {
  const [store] = useState(() => singleProcessingStore)

  const activeTab = getActiveTab()

  if (activeTab === undefined) {
    return null
  }

  // These next states are set from settings in `SidebarDisplaySettings`.
  const [selectedDisplays, setSelectedDisplays] = useState<DisplaysList>([])
  const [hiddenQuestions, setHiddenQuestions] = useState<string[]>([])

  const transcript = useMemo(() => {
    return getLatestTranscriptVersionItem(supplement, questionXpath)
  }, [supplement, questionXpath])

  const translations = useMemo(() => {
    return getAllTranslationsFromSupplementData(supplement, questionXpath)
  }, [supplement, questionXpath])

  // Every time user changes the tab, we need to load the stored displays list
  // for that tab.
  useEffect(() => {
    //TODO: Move this out of store. This is only using the default values for displays based on activeTab
    setSelectedDisplays(store.getDisplays(activeTab))
  }, [activeTab])

  return (
    <div className={styles.root}>
      <SidebarDisplaySettings
        asset={asset}
        selectedDisplays={selectedDisplays}
        setSelectedDisplays={setSelectedDisplays}
        hiddenQuestions={hiddenQuestions}
        setHiddenQuestions={setHiddenQuestions}
        questionLabelLanguage={questionLabelLanguage}
        setQuestionLabelLanguage={setQuestionLabelLanguage}
      />
      <div className={styles.displays}>
        {/* {translations.map((translation) => {
          if (selectedDisplays.includes(translation.language)) {
            return <TransxDisplay transxVersionItem={translation} key={translation.language} />
          }

          return null
        })} */}

        {selectedDisplays.includes(StaticDisplays.Transcript) && transcript && (
          <TransxDisplay transxVersionItem={transcript} />
        )}

        {selectedDisplays.includes(StaticDisplays.Audio) && (
          <SidebarSubmissionMedia asset={asset} xpath={questionXpath} submission={submission} />
        )}

        {selectedDisplays.includes(StaticDisplays.Data) && (
          <SidebarSubmissionData
            asset={asset}
            xpath={questionXpath}
            hiddenQuestions={hiddenQuestions}
            questionLabelLanguage={questionLabelLanguage}
            submission={submission}
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
