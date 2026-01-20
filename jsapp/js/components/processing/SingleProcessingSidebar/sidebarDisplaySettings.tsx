import React, { useMemo, useState } from 'react'

import { Box, Flex, Modal, ScrollArea, Stack, Text } from '@mantine/core'
import Button from '#/components/common/button'
import KoboSelect from '#/components/common/koboSelect'
import type { KoboSelectOption } from '#/components/common/koboSelect'
import MultiCheckbox from '#/components/common/multiCheckbox'
import type { MultiCheckboxItem } from '#/components/common/multiCheckbox'
import ToggleSwitch from '#/components/common/toggleSwitch'
import type { LanguageCode } from '#/components/languages/languagesStore'
import { AsyncLanguageDisplayLabel } from '#/components/languages/languagesUtils'
import { getActiveTab } from '#/components/processing/routes.utils'
import singleProcessingStore, { StaticDisplays } from '#/components/processing/singleProcessingStore'
import type { DisplaysList } from '#/components/processing/singleProcessingStore'
import { XML_VALUES_OPTION_VALUE } from '#/constants'
import type { AssetResponse } from '#/dataInterface'

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
          <Text fw={700} component='span'>
            {t('Original transcript')}
            {' ('}
            <AsyncLanguageDisplayLabel code={transcript.languageCode} />
            {')'}
          </Text>
        )
      }
      return null
    } else if (display === StaticDisplays.Data) {
      return (
        <Text fw={700} component='span'>
          {t('Submission data')}
        </Text>
      )
    } else {
      return (
        <Text fw={700} component='span'>
          {t('Original file (Audio)')}
        </Text>
      )
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
    <Flex justify='flex-end' align='center' h={48}>
      <Button
        size='m'
        type='text'
        label={t('Display settings')}
        startIcon='settings'
        onClick={() => setIsModalOpen(true)}
      />
      <Modal
        opened={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={t('Customize display settings')}
        size='lg'
        centered
        padding='lg'
        overlayProps={{ backgroundOpacity: 0.55, blur: 3 }}
      >
        <Stack gap='lg'>
          <Text size='md'>
            {t('Select the information you want to display in the side menu to support your analysis.')}
          </Text>

          <Stack gap='md'>
            <Box>
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
            </Box>
            {availableDisplays.map((entry) => {
              const isEnabled = selectedDisplays.includes(entry)

              if (entry in StaticDisplays) {
                const staticDisplay = entry as StaticDisplays
                const isSubmissionData = staticDisplay === StaticDisplays.Data

                return (
                  <Box key={entry}>
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
                      <Box mt='sm' ml={36}>
                        <Text size='sm' mb='xs'>
                          {t('Select the submission data to display.')}
                        </Text>
                        <ScrollArea
                          h={160}
                          p='xs'
                          bd='1px solid'
                          style={{ borderColor: 'var(--mantine-color-gray-4)' }}
                        >
                          <MultiCheckbox type='bare' items={getCheckboxes()} onChange={onCheckboxesChange} />
                        </ScrollArea>
                      </Box>
                    )}
                  </Box>
                )
              } else {
                // TODO: Check later to see if translations/languages is working, since now we don't have the data for it.
                return (
                  <Box key={entry}>
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
                        <Text fw={700} component='span'>
                          {t('Translation')}
                          {' ('}
                          <AsyncLanguageDisplayLabel code={entry} />
                          {')'}
                        </Text>
                      }
                    />
                  </Box>
                )
              }
            })}
          </Stack>
        </Stack>
      </Modal>
    </Flex>
  )
}
