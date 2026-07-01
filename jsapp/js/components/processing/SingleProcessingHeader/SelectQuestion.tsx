import React, { useMemo } from 'react'

import classNames from 'classnames'
import type { DataResponse } from '#/api/models/dataResponse'
import {
  findRowByXpathOrLeafName,
  getLanguageIndex,
  getRowName,
  getRowTypeIcon,
  getTranslatedRowLabel,
} from '#/assetUtils'
import KoboSelect from '#/components/common/koboSelect'
import type { LanguageCode } from '#/components/languages/languagesStore'
import { getActiveTab, goToProcessing } from '#/components/processing/routes.utils'
import { QUESTION_TYPES } from '#/constants'
import type { AssetResponse, SurveyRow } from '#/dataInterface'
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
        goToProcessing(asset.uid, newXpath, currentSubmissionUid, getActiveTab()),
      )
    }
  }

  /**
   * We display all questions with audio response type
   */
  const options = useMemo(() => {
    const assetContent = asset.content
    const languageIndex = getLanguageIndex(asset, questionLabelLanguage)

    if (!assetContent?.survey) {
      return []
    }

    const isAudioRow = (type: string) =>
      type === QUESTION_TYPES.audio.id || type === QUESTION_TYPES['background-audio'].id

    const buildOption = (optionXpath: string, row: SurveyRow) => {
      const rowName = getRowName(row)
      return {
        value: optionXpath,
        label: getTranslatedRowLabel(rowName, assetContent.survey, languageIndex) ?? rowName,
        icon: getRowTypeIcon(row.type),
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

    return result
  }, [asset.content, questionLabelLanguage, submission])

  return (
    <section className={classNames(styles.column, styles.columnMain)}>
      <KoboSelect
        name='single-processing-question-selector'
        type='gray'
        size='l'
        options={options}
        selectedOption={xpath}
        onChange={onQuestionSelectChange}
      />
    </section>
  )
}
