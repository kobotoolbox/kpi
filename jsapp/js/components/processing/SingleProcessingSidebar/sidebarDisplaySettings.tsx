import React, { useMemo, useState } from 'react'

import { Box, Flex, Modal, ScrollArea, Stack, Text } from '@mantine/core'
import { getFlatQuestionsList, getLanguageIndex } from '#/assetUtils'
import Button from '#/components/common/button'
import KoboSelect from '#/components/common/koboSelect'
import type { KoboSelectOption } from '#/components/common/koboSelect'
import MultiCheckbox from '#/components/common/multiCheckbox'
import type { MultiCheckboxItem } from '#/components/common/multiCheckbox'
import ToggleSwitch from '#/components/common/toggleSwitch'
import type { LanguageCode } from '#/components/languages/languagesStore'
import { AsyncLanguageDisplayLabel } from '#/components/languages/languagesUtils'
import { ProcessingTab, getActiveTab } from '#/components/processing/routes.utils'
import { XML_VALUES_OPTION_VALUE } from '#/constants'
import type { AssetResponse } from '#/dataInterface'
import { recordValues } from '#/utils'
import type { DisplaysList, TranscriptVersionItem, TranslationVersionItem } from '../common/types'
import { StaticDisplays } from '../common/utils'

interface SidebarDisplaySettingsProps {
  asset: AssetResponse
  selectedDisplays: DisplaysList
  setSelectedDisplays: (displays: DisplaysList) => void
  hiddenQuestions: string[]
  setHiddenQuestions: (questions: string[]) => void
  questionLabelLanguage: LanguageCode | string
  setQuestionLabelLanguage: (languageCode: LanguageCode | string) => void
  transcript: TranscriptVersionItem | undefined
  translations: TranslationVersionItem[]
}

export default function SidebarDisplaySettings({
  asset,
  selectedDisplays,
  setSelectedDisplays,
  hiddenQuestions,
  setHiddenQuestions,
  questionLabelLanguage,
  setQuestionLabelLanguage,
  transcript,
  translations,
}: SidebarDisplaySettingsProps) {
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false)

  const assetLanguageOptions = useMemo<KoboSelectOption[]>(() => {
    const baseLabel = t('Labels')
    const languages = asset?.summary?.languages?.length ? asset?.summary?.languages : [null]
    return [
      { label: t('XML values'), value: XML_VALUES_OPTION_VALUE },
      ...languages.map((language) => ({
        label: language !== null ? `${baseLabel} - ${language}` : baseLabel,
        value: language ?? '',
      })),
    ]
  }, [asset?.summary?.languages])

  const activeTab = getActiveTab()

  const availableLanguages: LanguageCode[] = useMemo(() => {
    return translations.map((translation) => translation._data.language)
  }, [translations])

  const availableDisplays = useMemo<Array<LanguageCode | StaticDisplays>>(() => {
    let displays: Array<LanguageCode | StaticDisplays> = [...recordValues(StaticDisplays), ...availableLanguages]

    // Filter out transcript if we are on the transcript tab or if it was deleted
    if (
      activeTab === ProcessingTab.Transcript ||
      !transcript?._data ||
      'value' in transcript?._data === false ||
      transcript?._data.value === null
    ) {
      displays = displays.filter((display) => display !== StaticDisplays.Transcript)
    }

    return displays
  }, [availableLanguages, activeTab, transcript])

  if (activeTab === undefined) {
    return null
  }

  /**
   * Returns label for toggle for given display.
   */
  function getStaticDisplayText(display: StaticDisplays) {
    if (display === StaticDisplays.Transcript) {
      if (transcript) {
        return (
          <Text fw={700} component='span'>
            {t('Original transcript')}
            {' ('}
            <AsyncLanguageDisplayLabel code={transcript._data.language} />
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
    if (asset?.content?.survey) {
      const questionsList = getFlatQuestionsList(
        asset.content.survey,
        getLanguageIndex(asset, questionLabelLanguage as LanguageCode),
      ).map((question) => {
        // We make an object to show the question label to the user but use the
        // name internally so it works with duplicate question labels
        return { name: question.name, label: question.label, checked: isFieldChecked(question.name) }
      })
      return questionsList
    }

    return []
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
        padding='xl'
        overlayProps={{ backgroundOpacity: 0.55, blur: 3 }}
      >
        <Stack gap='lg' pt='md'>
          <Text size='md'>
            {t('Select the information you want to display in the side menu to support your analysis.')}
          </Text>

          <Stack gap='lg'>
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
                          style={{ borderColor: 'var(--mantine-color-gray-6)', borderRadius: 6 }}
                        >
                          <MultiCheckbox type='bare' items={getCheckboxes()} onChange={onCheckboxesChange} />
                        </ScrollArea>
                      </Box>
                    )}
                  </Box>
                )
              } else {
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
