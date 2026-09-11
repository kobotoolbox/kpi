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
import { isNlpSupported } from '#/components/processing/common/utils'
import { getActiveLanguageCode, getActiveTab, goToProcessing } from '#/components/processing/routes.utils'
import {
  findAttachmentByQuestionXpath,
  inferAttachmentQuestionType,
} from '#/components/submissions/submissionMediaUtils'
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
   * We display all NLP supported questions
   */
  const { options, icons } = useMemo(() => {
    const assetContent = asset.content
    const languageIndex = getLanguageIndex(asset, questionLabelLanguage)

    if (!assetContent?.survey) {
      return { options: [], icons: {} }
    }

    const isSupportedRow = (type: SurveyRow['type']) => isNlpSupported(type)

    // Mantine's Select has no per-option icon prop, so we keep them in a lookup
    // that `renderOption` (and the left section) can use.
    const icons: Record<string, IconName | undefined> = {}

    /**
     * Builds the option for NLP supported questions.
     * No `row` means the form no longer has the question, and then the attachment's
     * mimetype gives the type and the recorded path the label.
     */
    const buildOption = (optionXpath: string, row: SurveyRow | undefined) => {
      const attachment = row ? undefined : findAttachmentByQuestionXpath(submission, optionXpath)
      const type = row?.type ?? (attachment && inferAttachmentQuestionType(attachment))
      if (!type || !isSupportedRow(type)) {
        return undefined
      }

      icons[optionXpath] = getRowTypeIcon(type)
      const rowName = row && getRowName(row)
      return {
        value: optionXpath,
        label: rowName
          ? (getTranslatedRowLabel(rowName, assetContent.survey, languageIndex) ?? rowName)
          : (optionXpath.split('/').at(-1) ?? optionXpath),
      }
    }

    const result = assetContent.survey
      .filter((question): question is SurveyRow & { $xpath: NonNullable<SurveyRow['$xpath']> } => !!question.$xpath)
      .map((question) => buildOption(question.$xpath, question))
      .filter((option) => option !== undefined)

    // Renames and removals leave answers under paths the current schema no longer
    // has. Walking the submission's own keys keeps every option tied to real data.
    for (const submissionXpath of Object.keys(submission)) {
      if (result.some((option) => option.value === submissionXpath)) {
        continue
      }
      // Schema first: a renamed group still matches by leaf name.
      const option = buildOption(submissionXpath, findRowByXpathOrLeafName(assetContent, submissionXpath))
      if (option) {
        result.push(option)
      }
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
