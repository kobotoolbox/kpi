import React, { useEffect, useState } from 'react'
import type { DataResponse } from '#/api/models/dataResponse'
import type { DataSupplementResponse } from '#/api/models/dataSupplementResponse'
import type { LanguageCode } from '#/components/languages/languagesStore'
import type { AssetResponse } from '#/dataInterface'
import { getTranscriptFromSupplement, getTranslationsFromSupplement } from '../common/utils'
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

  // Every time user changes the tab, we need to load the stored displays list
  // for that tab.
  useEffect(() => {
    //TODO: Move this out of store. This is only using the default values for displays based on activeTab
    setSelectedDisplays(store.getDisplays(activeTab))
  }, [activeTab])

  const transcriptVersion = getTranscriptFromSupplement(supplement[questionXpath])
  const translationVersions = getTranslationsFromSupplement(supplement[questionXpath])

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
        {/*
        TODO: BUG for some reason I don't see transcript or other translation in the sidebar. I don't have options to
        choose them in the settings modal either.
        */}
        {Array.from(translationVersions).map((translationVersion) => {
          if (selectedDisplays.includes(translationVersion._data.language)) {
            return <TransxDisplay supplementVersion={translationVersion} key={translationVersion._data.language} />
          }

          return null
        })}

        {selectedDisplays.includes(StaticDisplays.Transcript) && transcriptVersion && (
          <TransxDisplay supplementVersion={transcriptVersion} />
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
