import React, { useMemo } from 'react'

import classNames from 'classnames'
import { getRowName, getRowTypeIcon, getTranslatedRowLabel } from '#/assetUtils'
import KoboSelect from '#/components/common/koboSelect'
import { goToProcessing } from '#/components/processing/routes.utils'
import { QUESTION_TYPES } from '#/constants'
import type { AssetResponse, SurveyRow } from '#/dataInterface'
import styles from './index.module.scss'

interface Props {
  currentSubmissionUid: string
  asset: AssetResponse
  xpath: string
}

/**
 * Component with the current question label and the UI for switching between
 * submissions and questions. It also has means of leaving Single Processing
 * via "DONE" button.
 */
export default function SelectQuestion({ asset, currentSubmissionUid, xpath }: Props) {
  const onQuestionSelectChange = (newXpath: string | null) => {
    if (newXpath !== null) {
      goToProcessing(asset.uid, xpath, currentSubmissionUid, true)
    }
  }

  /**
   * We display all questions with audio response type
   */
  const options = useMemo(() => {
    const assetContent = asset.content
    const languageIndex = 0 // TODO: getLanguageIndex(asset, singleProcessingStore.getCurrentlyDisplayedLanguage())

    if (!assetContent?.survey) {
      return []
    }

    return assetContent.survey
      .filter((question): question is SurveyRow & { $xpath: NonNullable<SurveyRow['$xpath']> } => !!question.$xpath)
      .filter(({ type }) => type === QUESTION_TYPES.audio.id || type === QUESTION_TYPES['background-audio'].id)
      .map((question) => {
        const rowName = getRowName(question)
        return {
          value: question.$xpath,
          label: getTranslatedRowLabel(rowName, assetContent.survey, languageIndex) ?? rowName,
          icon: getRowTypeIcon(question.type),
        }
      })
  }, [asset.content])

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
