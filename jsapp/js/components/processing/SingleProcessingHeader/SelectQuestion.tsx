import React, { useCallback } from 'react'

import classNames from 'classnames'
import {
  type assetsAdvancedFeaturesListResponse,
  getAssetsAdvancedFeaturesListQueryKey,
  useAssetsAdvancedFeaturesList,
} from '#/api/react-query/survey-data'
import { findRowByXpath, getRowName, getRowTypeIcon, getTranslatedRowLabel } from '#/assetUtils'
import KoboSelect from '#/components/common/koboSelect'
import type { KoboSelectOption } from '#/components/common/koboSelect'
import { goToProcessing } from '#/components/processing/routes.utils'
import { QUESTION_TYPES } from '#/constants'
import type { AssetResponse } from '#/dataInterface'
import styles from './index.module.scss'

// TODO: improve schema to enum `action` prop.
const ADVANCED_FEATURES_ACTION = [
  'manual_transcription',
  'manual_translation',
  'automatic_google_transcription',
  'automatic_google_translation',
]
// TODO: improve schema, AdvancedFeatureResponse.asset doesn't exist for the above.

interface Props {
  submissionEditId: string
  asset: AssetResponse
  xpath: string
}

/**
 * Component with the current question label and the UI for switching between
 * submissions and questions. It also has means of leaving Single Processing
 * via "DONE" button.
 */
export default function SelectQuestion({ asset, submissionEditId, xpath }: Props) {
  const onQuestionSelectChange = (newXpath: string | null) => {
    if (newXpath !== null) {
      goToSubmission(newXpath, submissionEditId)
    }
  }

  /**
   * We display all questions with audio response type
   */
  const getQuestionSelectorOptions = () => {
    const options: KoboSelectOption[] = []
    const assetContent = asset.content
    const languageIndex = 0 //getLanguageIndex(asset, singleProcessingStore.getCurrentlyDisplayedLanguage())

    if (!assetContent) {
      return []
    }

    assetContent.survey?.forEach((question) => {
      if (
        question.$xpath &&
        (question.type === QUESTION_TYPES.audio.id || question.type === QUESTION_TYPES['background-audio'].id)
      ) {
        const rowName = getRowName(question)
        const translatedLabel = getTranslatedRowLabel(rowName, assetContent.survey, languageIndex)
        options.push({
          value: question.$xpath,
          label: translatedLabel !== null ? translatedLabel : rowName,
          icon: getRowTypeIcon(question.type),
        })
      }
    })
    return options
  }

  /** Goes to another submission. */
  const goToSubmission = (xpath: string, targetSubmissionEditId: string) => {
    goToProcessing(asset.uid, xpath, targetSubmissionEditId, true)
  }

  return (
    <section className={classNames(styles.column, styles.columnMain)}>
      <KoboSelect
        name='single-processing-question-selector'
        type='gray'
        size='l'
        options={getQuestionSelectorOptions()}
        selectedOption={xpath}
        onChange={onQuestionSelectChange}
      />
    </section>
  )
}
