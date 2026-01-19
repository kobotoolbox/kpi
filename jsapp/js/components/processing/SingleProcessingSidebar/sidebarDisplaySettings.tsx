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
import KoboModalFooter from '#/components/modals/koboModalFooter'
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

  function getInitialFields(customHiddenQuestions?: string[]) {
    const allQuestions = store.getAllSidebarQuestions()
    const hiddenFields = customHiddenQuestions || hiddenQuestions

    // Remove the fields hidden in the store so it persists when
    // across navigating submissions.
    const questionsList = allQuestions.filter((question) => !hiddenFields.includes(question.name))
    return questionsList
  }

  const [localSelectedDisplays, setLocalSelectedDisplays] = useState<DisplaysList>(() => selectedDisplays)
  const [selectedFields, setSelectedFields] = useState(() => getInitialFields())

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
    setLocalSelectedDisplays(Array.from(new Set([...localSelectedDisplays, displayName])))
  }

  function disableDisplay(displayName: LanguageCode | StaticDisplays) {
    setLocalSelectedDisplays(localSelectedDisplays.filter((selectedDisplayName) => selectedDisplayName !== displayName))
  }

  function isFieldChecked(questionName: string) {
    return selectedFields.some((field) => field.name === questionName)
  }

  function getCheckboxes() {
    const checkboxes = store.getAllSidebarQuestions().map((question) => {
      return {
        label: question.label,
        checked: isFieldChecked(question.name),
        name: question.name,
        disabled: !localSelectedDisplays.includes(StaticDisplays.Data),
      }
    })

    return checkboxes
  }

  // To make the code a little simpler later on, we need an inverse array here
  // to send to the the display, and a normal array to keep track of the
  // checkboxes in this modal.
  function onCheckboxesChange(list: MultiCheckboxItem[]) {
    const newList = list
      .filter((question) => question.checked)
      .map((question) => {
        return { name: question.name, label: question.label }
      })

    setSelectedFields(newList)
  }

  function applyFieldsSelection() {
    const hiddenList =
      getCheckboxes()
        .filter((question) => !question.checked)
        .map((question) => question.name) || []

    setHiddenQuestions(hiddenList)
  }

  function resetFieldsSelection() {
    // Since we check the store for hidden fields and use that to get our
    // checkboxes, using `applyFieldsSelection` here would never actually
    // reset the checkboxes visually so we explicitly set it to empty here.
    setSelectedFields(getInitialFields([]))
  }

  return (
    <div className={styles.root}>
      <Button
        size='m'
        type='text'
        label={t('Display settings')}
        startIcon='settings'
        onClick={() => {
          // Reset modals and checkboxes to current state when opening.
          setLocalSelectedDisplays(selectedDisplays)
          setSelectedFields(getInitialFields())
          setIsModalOpen(true)
        }}
      />
      <KoboModal
        isOpen={isModalOpen}
        onRequestClose={() => {
          setIsModalOpen(false)
        }}
        size='medium'
      >
        <KoboModalHeader
          onRequestCloseByX={() => {
            setSelectedDisplays(store.getDisplays(activeTab))
            setSelectedFields(getInitialFields())
            setIsModalOpen(false)
          }}
        >
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
              const isEnabled = localSelectedDisplays.includes(entry)

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

        <KoboModalFooter alignment='center'>
          {/* This button resets the displays for current tab. */}
          <Button
            label={t('Reset')}
            type='secondary-danger'
            size='m'
            onClick={() => {
              // Apply reset to local state of selected displays. This is needed
              // because the modal component (and its state) is kept alive even
              // when the modal is closed.
              resetFieldsSelection()
              setLocalSelectedDisplays(store.getDisplays(activeTab))
              setLabelLanguage(store.getCurrentlyDisplayedLanguage())
            }}
          />

          {/* Applies current selection of displays to the sidebar. */}
          <Button
            label={t('Apply selection')}
            type='primary'
            size='m'
            onClick={() => {
              applyFieldsSelection()
              setSelectedDisplays(localSelectedDisplays)
              store.setCurrentlyDisplayedLanguage(labelLanguage)
              setIsModalOpen(false)
            }}
          />
        </KoboModalFooter>
      </KoboModal>
    </div>
  )
}
