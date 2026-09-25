import { Group } from '@mantine/core'
import classNames from 'classnames'
import React, { useMemo } from 'react'
import type { DataResponse } from '#/api/models/dataResponse'
import { getLanguageIndex, getRowName, getRowTypeIcon, getTranslatedRowLabel } from '#/assetUtils'
import Select from '#/components/common/Select'
import Icon from '#/components/common/icon'
import type { LanguageCode } from '#/components/languages/languagesStore'
import { getProcessingQuestionType } from '#/components/processing/common/questionType'
import { isNlpSupported } from '#/components/processing/common/utils'
import { getActiveLanguageCode, getActiveTab, goToProcessing } from '#/components/processing/routes.utils'
import { getSubmissionDataListItems } from '#/components/submissions/submissionDataListUtils'
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

    // Mantine's Select has no per-option icon prop, so we keep them in a lookup
    // that `renderOption` (and the left section) can use.
    const icons: Record<string, IconName | undefined> = {}

    /**
     * The option for an NLP supported question, or `undefined` when the path holds nothing
     * NLP can work with. `row` supplies the translated label where the form still has one;
     * without it the type comes from the submission, so a moved question is still offered.
     */
    const buildOption = (optionXpath: string, row?: SurveyRow) => {
      const type = row?.type ?? getProcessingQuestionType(asset, optionXpath, submission)
      if (!type || !isNlpSupported(type)) {
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

    // A question renamed, moved or deleted since has no row above, but the submission still holds
    // its answer, its file or its NLP work. The data list is what tells an answer from metadata.
    const submissionXpaths = new Set<string>([
      ...getSubmissionDataListItems(asset, languageIndex, submission).map((item) => item.key),
      ...(submission._attachments ?? []).map((attachment) => attachment.question_xpath),
      ...Object.keys(submission._supplementalDetails ?? {}),
    ])

    for (const submissionXpath of submissionXpaths) {
      if (!submissionXpath || result.some((option) => option.value === submissionXpath)) {
        continue
      }
      const option = buildOption(submissionXpath)
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
