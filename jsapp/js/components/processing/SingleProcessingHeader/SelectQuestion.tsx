import { Group } from '@mantine/core'
import classNames from 'classnames'
import React, { useMemo } from 'react'
import type { DataResponse } from '#/api/models/dataResponse'
import {
  findRowByXpathOrLeafName,
  getLanguageIndex,
  getRowName,
  getRowTypeIcon,
  getTranslatedRowLabel,
} from '#/assetUtils'
import Select from '#/components/common/Select'
import Icon from '#/components/common/icon'
import type { LanguageCode } from '#/components/languages/languagesStore'
import { getActiveLanguageCode, getActiveTab, goToProcessing } from '#/components/processing/routes.utils'
import { QUESTION_TYPES } from '#/constants'
import type { AssetResponse, SurveyRow } from '#/dataInterface'
import type { IconName } from '#/k-icons'
import protectorHelpers from '#/protector/protectorHelpers'
import styles from './index.module.scss'

interface Props {
  currentSubmissionUid: string
  asset: AssetResponse
  submission: DataResponse
  questionLabelLanguage: LanguageCode | string
  xpath: string
  hasUnsavedWork: boolean
}

/**
 * Component with the current question label and the UI for switching between
 * submissions and questions. It also has means of leaving Single Processing
 * via "DONE" button.
 */
export default function SelectQuestion({
  asset,
  submission,
  currentSubmissionUid,
  questionLabelLanguage,
  xpath,
  hasUnsavedWork,
}: Props) {
  const onQuestionSelectChange = (newXpath: string | null) => {
    if (newXpath !== null) {
      protectorHelpers.safeExecute(hasUnsavedWork, () =>
        goToProcessing(asset.uid, newXpath, currentSubmissionUid, getActiveTab(), getActiveLanguageCode()),
      )
    }
  }

  /**
   * We display all questions with audio response type
   */
  const { options, icons } = useMemo(() => {
    const assetContent = asset.content
    const languageIndex = getLanguageIndex(asset, questionLabelLanguage)

    if (!assetContent?.survey) {
      return { options: [], icons: {} }
    }

    const isAudioRow = (type: string) =>
      type === QUESTION_TYPES.audio.id || type === QUESTION_TYPES['background-audio'].id

    // Mantine's Select has no per-option icon prop, so we keep them in a lookup
    // that `renderOption` (and the left section) can use.
    const icons: Record<string, IconName | undefined> = {}

    const buildOption = (optionXpath: string, row: SurveyRow) => {
      const rowName = getRowName(row)
      icons[optionXpath] = getRowTypeIcon(row.type)
      return {
        value: optionXpath,
        label: getTranslatedRowLabel(rowName, assetContent.survey, languageIndex) ?? rowName,
      }
    }

    const result = assetContent.survey
      .filter((question): question is SurveyRow & { $xpath: NonNullable<SurveyRow['$xpath']> } => !!question.$xpath)
      .filter(({ type }) => isAudioRow(type))
      .map((question) => buildOption(question.$xpath, question))

    // Add entries for audio questions answered in this submission but missing
    // from the current schema (e.g. after a group rename).
    for (const submissionXpath of Object.keys(submission)) {
      if (result.some((o) => o.value === submissionXpath)) {
        continue
      }
      const foundRow = findRowByXpathOrLeafName(assetContent, submissionXpath)
      if (!foundRow || !isAudioRow(foundRow.type)) {
        continue
      }
      result.push(buildOption(submissionXpath, foundRow))
    }

    return { options: result, icons }
  }, [asset.content, questionLabelLanguage, submission])

  const selectedIcon = icons[xpath]

  return (
    <section className={classNames(styles.column, styles.columnMain)}>
      <Select
        size='md'
        clearable={false}
        data={options}
        value={xpath}
        onChange={onQuestionSelectChange}
        leftSection={selectedIcon && <Icon name={selectedIcon} size='s' />}
        renderOption={({ option }) => {
          const icon = icons[option.value]
          return (
            <Group gap='xs' wrap='nowrap'>
              {icon && <Icon name={icon} size='s' />}
              <span>{option.label}</span>
            </Group>
          )
        }}
      />
    </section>
  )
}
