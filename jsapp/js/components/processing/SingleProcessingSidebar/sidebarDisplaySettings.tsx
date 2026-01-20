import React, { useMemo, useState } from 'react'

import cx from 'classnames'
import Button from '#/components/common/button'
import KoboSelect from '#/components/common/koboSelect'
import type { KoboSelectOption } from '#/components/common/koboSelect'
import MultiCheckbox from '#/components/common/multiCheckbox'
import type { MultiCheckboxItem } from '#/components/common/multiCheckbox'
import ToggleSwitch from '#/components/common/toggleSwitch'
import type { LanguageCode } from '#/components/languages/languagesStore'
import { AsyncLanguageDisplayLabel } from '#/components/languages/languagesUtils'
import KoboModal from '#/components/modals/koboModal'
import KoboModalContent from '#/components/modals/koboModalContent'
import KoboModalHeader from '#/components/modals/koboModalHeader'
import { getActiveTab } from '#/components/processing/routes.utils'
import singleProcessingStore, { StaticDisplays } from '#/components/processing/singleProcessingStore'
import type { DisplaysList } from '#/components/processing/singleProcessingStore'
import { XML_VALUES_OPTION_VALUE } from '#/constants'
import type { AssetResponse } from '#/dataInterface'
import styles from './sidebarDisplaySettings.module.scss'

interface SidebarDisplaySettingsProps {
  asset: AssetResponse
  selectedDisplays: DisplaysList
  setSelectedDisplays: (displays: DisplaysList) => void
  hiddenQuestions: string[]
  setHiddenQuestions: (questions: string[]) => void
  questionLabelLanguage: LanguageCode | string
  setQuestionLabelLanguage: (languageCode: LanguageCode | string) => void
}

export default function SidebarDisplaySettings({
  asset,
  selectedDisplays,
  setSelectedDisplays,
  hiddenQuestions,
  setHiddenQuestions,
  questionLabelLanguage,
  setQuestionLabelLanguage,
}: SidebarDisplaySettingsProps) {
  const [store] = useState(() => singleProcessingStore)
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false)
  const [labelLanguage, setLabelLanguage] = useState<LanguageCode | string>(store.getCurrentlyDisplayedLanguage())

  const assetLanguageOptions = useMemo<KoboSelectOption[]>(() => {
    const languageOptions: KoboSelectOption[] = [{ label: t('XML values'), value: XML_VALUES_OPTION_VALUE }]

    const baseLabel = t('Labels')
    const languages = asset?.summary?.languages

    if (languages && languages.length > 0) {
      languages.forEach((language) => {
        languageOptions.push({
          label: language !== null ? `${baseLabel} - ${language}` : baseLabel,
          value: language ?? '',
        })
      })
    } else {
      languageOptions.push({ label: baseLabel, value: '' })
    }

    return languageOptions
  }, [asset?.summary?.languages])

  const activeTab = getActiveTab()

  if (activeTab === undefined) {
    return null
  }

  const transcript = store.getTranscript()
  const availableDisplays = store.getAvailableDisplays(activeTab)

  // Returns the list of available displays for the current tab.
  // I.e., if we are on the transcript tab, hide the transcript option.
  function getStaticDisplayText(display: StaticDisplays) {
    if (display === StaticDisplays.Transcript) {
      if (transcript) {
        return (
          <strong className={styles.wrapWithParens}>
            {t('Original transcript')}
            &nbsp;
            <AsyncLanguageDisplayLabel code={transcript.languageCode} />
          </strong>
        )
      }
      return null
    } else if (display === StaticDisplays.Data) {
      return <strong>{t('Submission data')}</strong>
    } else {
      return <strong>{t('Original file (Audio)')}</strong>
    }
  }

  function enableDisplay(displayName: LanguageCode | StaticDisplays) {
    setSelectedDisplays(Array.from(new Set([...selectedDisplays, displayName])))
  }

  function disableDisplay(displayName: LanguageCode | StaticDisplays) {
    setSelectedDisplays(selectedDisplays.filter((selectedDisplayName) => selectedDisplayName !== displayName))
  }

  function isFieldChecked(questionName: string) {
    return !hiddenQuestions.includes(questionName)
  }

  function getCheckboxes() {
    const checkboxes = store.getAllSidebarQuestions().map((question) => {
      return {
        label: question.label,
        checked: isFieldChecked(question.name),
        name: question.name,
        disabled: !selectedDisplays.includes(StaticDisplays.Data),
      }
    })

    return checkboxes
  }

  function onCheckboxesChange(list: MultiCheckboxItem[]) {
    const hiddenList = list.filter((question) => !question.checked).map((question) => question.name)

    setHiddenQuestions(hiddenList)
  }

  return (
    <div className={styles.root}>
      <Button
        size='m'
        type='text'
        label={t('Display settings')}
        startIcon='settings'
        onClick={() => setIsModalOpen(true)}
      />
      <KoboModal
        isOpen={isModalOpen}
        onRequestClose={() => {
          setIsModalOpen(false)
        }}
        size='medium'
      >
        <KoboModalHeader onRequestCloseByX={() => setIsModalOpen(false)}>
          {t('Customize display settings')}
        </KoboModalHeader>

        <KoboModalContent>
          <p className={styles.description}>
            {t('Select the information you want to display in the side menu to support your analysis.')}
          </p>

          <ul className={styles.options}>
            <li className={styles.display}>
              <KoboSelect
                label={t('Display labels or XML values?')}
                name='displayedLanguage'
                type='outline'
                size='s'
                options={assetLanguageOptions}
                selectedOption={questionLabelLanguage}
                onChange={(languageCode) => {
                  if (languageCode !== null) {
                    setQuestionLabelLanguage(languageCode)
                  }
                }}
              />
            </li>

            {availableDisplays.map((entry) => {
              const isEnabled = selectedDisplays.includes(entry)

              if (entry in StaticDisplays) {
                const staticDisplay = entry as StaticDisplays
                const isSubmissionData = staticDisplay === StaticDisplays.Data

                return (
                  <li className={cx(styles.display)} key={entry}>
                    <ToggleSwitch
                      onChange={(isChecked) => {
                        if (isChecked) {
                          enableDisplay(entry)
                        } else {
                          disableDisplay(entry)
                        }
                      }}
                      checked={isEnabled}
                      label={getStaticDisplayText(staticDisplay)}
                    />

                    {isSubmissionData && (
                      <div className={styles.questionList}>
                        {t('Select the submission data to display.')}
                        <div className={styles.checkbox}>
                          <MultiCheckbox type='bare' items={getCheckboxes()} onChange={onCheckboxesChange} />
                        </div>
                      </div>
                    )}
                  </li>
                )
              } else {
                // TODO: Check later to see if translations/languages is working, since now we don't have the data for it.
                return (
                  <li className={styles.display} key={entry}>
                    <ToggleSwitch
                      onChange={(isChecked) => {
                        if (isChecked) {
                          enableDisplay(entry)
                        } else {
                          disableDisplay(entry)
                        }
                      }}
                      checked={isEnabled}
                      label={
                        <strong className={styles.wrapWithParens}>
                          {t('Translation')}
                          &nbsp;
                          <AsyncLanguageDisplayLabel code={entry} />
                        </strong>
                      }
                    />
                  </li>
                )
              }
            })}
          </ul>
        </KoboModalContent>
      </KoboModal>
    </div>
  )
}
