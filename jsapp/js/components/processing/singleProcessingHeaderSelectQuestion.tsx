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
import styles from './singleProcessingHeader.module.scss'

// TODO: improve schema to enum `action` prop.
const ADVANCED_FEATURES_ACTION = [
  'manual_transcription',
  'manual_translation',
  'automatic_google_transcription',
  'automatic_google_translation',
]
// TODO: improve schema, AdvancedFeatureResponse.asset doesn't exist for the above.
// TODO: improve ...

interface Props {
  submissionEditId: string
  assetUid: string
  asset: AssetResponse
  xpath: string
}

/**
 * Component with the current question label and the UI for switching between
 * submissions and questions. It also has means of leaving Single Processing
 * via "DONE" button.
 */
export default function SingleProcessingHeaderSelectQuestion({
  asset,
  assetUid,
  submissionEditId,
  xpath,
}: Props) {
  const queryAdvancedFeatures = useAssetsAdvancedFeaturesList(assetUid!, {
    query: {
      queryKey: getAssetsAdvancedFeaturesListQueryKey(assetUid!),
      enabled: !!assetUid,
      select: useCallback((data: assetsAdvancedFeaturesListResponse) => {
        return data.status === 200 ? data.data.filter((datum) => ADVANCED_FEATURES_ACTION.includes(datum.action)) : []
      }, []),
    },
  })

  const onQuestionSelectChange = (newXpath: string | null) => {
    if (newXpath !== null) {
      goToSubmission(newXpath, submissionEditId)
    }
  }

  // TODO: checking for question type is redundant here because that's how we decide on getSubmissionsEditIds
  /**
   * For displaying question selector - filtered down to questions with
   * responses and of audio type (for now).
   */
  const getQuestionSelectorOptions = () => {
    const options: KoboSelectOption[] = []
    const editIds = queryAdvancedFeatures.data!
    const assetContent = asset.content
    const languageIndex = 0 //getLanguageIndex(asset, singleProcessingStore.getCurrentlyDisplayedLanguage())

    if (!assetContent) {
      return []
    }

    if (editIds) {
      editIds.forEach((feature) => {
        const questionData = findRowByXpath(assetContent, feature.question_xpath)
        // At this point we want to find out whether the question has at least
        // one editId (i.e. there is at least one transcriptable response to
        // the question). Otherwise there's no point in having the question as
        // selectable option.
        const hasAtLeastOneEditId = true //Boolean(feature.find((editIdOrNull) => editIdOrNull !== null))
        if (questionData && hasAtLeastOneEditId) {
          // Only allow audio questions at this point (we plan to allow text
          // and video in future).
          if (
            questionData.type === QUESTION_TYPES.audio.id ||
            questionData.type === QUESTION_TYPES['background-audio'].id
          ) {
            const rowName = getRowName(questionData)
            const translatedLabel = getTranslatedRowLabel(rowName, assetContent.survey, languageIndex)
            options.push({
              value: feature.question_xpath,
              label: translatedLabel !== null ? translatedLabel : rowName,
              icon: getRowTypeIcon(questionData.type),
            })
          }
        }
      })
    }
    return options
  }

  /** Goes to another submission. */
  const goToSubmission = (xpath: string, targetSubmissionEditId: string) => {
    goToProcessing(assetUid, xpath, targetSubmissionEditId, true)
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
