import React from 'react'

import { useIsMutating } from '@tanstack/react-query'
import classNames from 'classnames'
import cloneDeep from 'lodash.clonedeep'
import type { DataResponse } from '#/api/models/dataResponse'
import type { DataSupplementResponse } from '#/api/models/dataSupplementResponse'
import type { ResponseQualActionParams } from '#/api/models/responseQualActionParams'
import Button from '#/components/common/button'
import Icon from '#/components/common/icon'
import KoboDropdown from '#/components/common/koboDropdown'
import { userCan } from '#/components/permissions/utils'
import type { AssetResponse } from '#/dataInterface'
import { getAllTranslationsFromSupplementData, getLatestTranscriptVersionItem } from '../../common/utils'
import styles from './AnalysisHeader.module.scss'
import { ANALYSIS_QUESTION_TYPES } from './common/constants'
import type { AdvancedFeatureResponseManualQual } from './common/utils'

interface Props {
  asset: AssetResponse
  questionXpath: string
  submission: DataResponse
  supplement: DataSupplementResponse
  advancedFeature: AdvancedFeatureResponseManualQual
  qaQuestion?: ResponseQualActionParams
  setQaQuestion: (qaQuestion: ResponseQualActionParams | undefined) => void
}

/**
 * This piece of UI is displaying the button/dropdown for adding new questions
 * (definitions). It also has a saving state indicator.
 */
export default function AnalysisHeader({ asset, questionXpath, supplement, qaQuestion, setQaQuestion }: Props) {
  const transcriptVersion = getLatestTranscriptVersionItem(supplement, questionXpath)
  const translationVersions = getAllTranslationsFromSupplementData(supplement, questionXpath)

  // Note: Technically correct would be to filter for the 3 specific mutations we are interested in,
  //       but practically what else user would mutate in the meantime and no filter effectively is the same.
  const isMutating = useIsMutating() > 0

  const manualQuestionDefs = ANALYSIS_QUESTION_TYPES.filter((definition) => !definition.isAutomated)
  // TODO: we hide Keyword Search from the UI until https://github.com/kobotoolbox/kpi/issues/4594 is done
  // const automatedQuestionDefs = ANALYSIS_QUESTION_TYPES.filter((definition) => definition.isAutomated)
  const questionDefs = [
    ...manualQuestionDefs,
    // TODO: we hide Keyword Search from the UI until https://github.com/kobotoolbox/kpi/issues/4594 is done
    // ...(automatedQuestionDefs.length > 0 ? [t('Automated analysis')] : []),
    // ...automatedQuestionDefs,
  ]

  return (
    <header className={styles.root}>
      <KoboDropdown
        placement={'down-left'}
        hideOnMenuClick
        triggerContent={<Button type='primary' size='m' startIcon='plus' label={t('Add question')} />}
        menuContent={
          <menu className={styles.addQuestionMenu}>
            {questionDefs.map((questionDef) => {
              return typeof questionDef === 'string' ? (
                <li key={'title'}>
                  <h2>{t('Automated analysis')}</h2>
                </li>
              ) : (
                <li
                  className={classNames({
                    [styles.addQuestionMenuButton]: true,
                    // We want to disable the Keyword Search question type when there is no transcript or translation.
                    [styles.addQuestionMenuButtonDisabled]:
                      questionDef.type === 'qualAutoKeywordCount' &&
                      transcriptVersion &&
                      translationVersions.length === 0,
                  })}
                  key={questionDef.type}
                  onClick={() => setQaQuestion(cloneDeep(questionDef.placeholder))}
                  tabIndex={0}
                >
                  <Icon name={questionDef.icon} />
                  <label>{questionDef.label}</label>
                </li>
              )
            })}
          </menu>
        }
        name='qualitative_analysis_add_question'
        // We only allow editing one question at a time, so adding new is not
        // possible until user stops editing
        isDisabled={!userCan('manage_asset', asset) || !!qaQuestion}
      />

      <span>
        {isMutating && t('Saving…')}
        {!isMutating && qaQuestion && t('Unsaved changes')}
        {!isMutating && !qaQuestion && t('Saved')}
      </span>
    </header>
  )
}
