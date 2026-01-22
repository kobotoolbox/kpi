import React, { useContext } from 'react'

import classNames from 'classnames'
import type { AdvancedFeatureResponse } from '#/api/models/advancedFeatureResponse'
import type { DataResponse } from '#/api/models/dataResponse'
import type { DataSupplementResponse } from '#/api/models/dataSupplementResponse'
import Button from '#/components/common/button'
import Icon from '#/components/common/icon'
import KoboDropdown from '#/components/common/koboDropdown'
import { userCan } from '#/components/permissions/utils'
import type { AssetResponse } from '#/dataInterface'
import { getAllTranslationsFromSupplementData, getLatestTranscriptVersionItem } from '../../common/utils'
import styles from './AnalysisHeader.module.scss'
import AnalysisQuestionsContext from './common/analysisQuestions.context'
import { ANALYSIS_QUESTION_TYPES } from './common/constants'
import type { AnalysisQuestionTypeDefinition } from './common/constants'

interface Props {
  asset: AssetResponse
  questionXpath: string
  submission: DataResponse & Record<string, string>
  supplement: DataSupplementResponse
  advancedFeatures: AdvancedFeatureResponse[]
}

/**
 * This piece of UI is displaying the button/dropdown for adding new questions
 * (definitions). It also has a saving state indicator.
 */
export default function AnalysisHeader({ asset, questionXpath, supplement }: Props) {
  const transcriptVersion = getLatestTranscriptVersionItem(supplement, questionXpath)
  const translationVersions = getAllTranslationsFromSupplementData(supplement, questionXpath)

  const analysisQuestions = useContext(AnalysisQuestionsContext)
  if (!analysisQuestions) {
    return null
  }

  const manualTypes = ANALYSIS_QUESTION_TYPES.filter((definition) => !definition.isAutomated)
  const automatedTypes = ANALYSIS_QUESTION_TYPES.filter((definition) => definition.isAutomated)

  function renderQuestionTypeButton(definition: AnalysisQuestionTypeDefinition) {
    return (
      <li
        className={classNames({
          [styles.addQuestionMenuButton]: true,
          // We want to disable the Keyword Search question type when there is
          // no transcript or translation.
          [styles.addQuestionMenuButtonDisabled]:
            definition.type === 'qual_auto_keyword_count' && transcriptVersion && translationVersions.length === 0,
        })}
        key={definition.type}
        onClick={() => {
          analysisQuestions?.dispatch({
            type: 'addQuestion',
            payload: {
              xpath: questionXpath,
              type: definition.type,
            },
          })
        }}
        tabIndex={0}
      >
        <Icon name={definition.icon} />
        <label>{definition.label}</label>
      </li>
    )
  }

  return (
    <header className={styles.root}>
      <KoboDropdown
        placement={'down-left'}
        hideOnMenuClick
        triggerContent={<Button type='primary' size='m' startIcon='plus' label={t('Add question')} />}
        menuContent={
          <menu className={styles.addQuestionMenu}>
            {manualTypes.map(renderQuestionTypeButton)}
            {automatedTypes.length > 0 && (
              <>
                <li>
                  <h2>{t('Automated analysis')}</h2>
                </li>
                {automatedTypes.map(renderQuestionTypeButton)}
              </>
            )}
          </menu>
        }
        name='qualitative_analysis_add_question'
        // We only allow editing one question at a time, so adding new is not
        // possible until user stops editing
        isDisabled={!userCan('manage_asset', asset) || analysisQuestions?.state.questionsBeingEdited.length !== 0}
      />

      <span>
        {!analysisQuestions.state.isPending && analysisQuestions.state.hasUnsavedWork && t('Unsaved changes')}
        {analysisQuestions.state.isPending && t('Saving…')}
        {!analysisQuestions.state.hasUnsavedWork && !analysisQuestions.state.isPending && t('Saved')}
      </span>
    </header>
  )
}
