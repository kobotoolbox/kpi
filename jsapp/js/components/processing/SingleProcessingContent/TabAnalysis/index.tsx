import React, { useMemo, useReducer, useState, useEffect } from 'react'

import classNames from 'classnames'
import type { DataResponse } from '#/api/models/dataResponse'
import type { DataSupplementResponse } from '#/api/models/dataSupplementResponse'
import LoadingSpinner from '#/components/common/loadingSpinner'
import singleProcessingStore from '#/components/processing/singleProcessingStore'
import type { AssetResponse } from '#/dataInterface'
import bodyStyles from '../../common/processingBody.module.scss'
import AnalysisContent from './AnalysisContent'
import AnalysisHeader from './AnalysisHeader'
import AnalysisQuestionsContext from './common/analysisQuestions.context'
import { analysisQuestionsReducer, initialState } from './common/analysisQuestions.reducer'
import {
  type AdvancedFeatureResponseManualQual,
  applyUpdateResponseToInternalQuestions,
  convertQuestionsFromSchemaToInternal,
} from './common/utils'

interface Props {
  asset: AssetResponse
  questionXpath: string
  submission: DataResponse & Record<string, string>
  onUnsavedWorkChange: (hasUnsavedWork: boolean) => void
  supplement: DataSupplementResponse
  advancedFeature: AdvancedFeatureResponseManualQual
}

/**
 * Displays content of the "Analysis" tab. This component is handling all of
 * the Qualitative Analysis functionality.
 */
export default function AnalysisTab({ asset, questionXpath, submission, supplement, advancedFeature }: Props) {
  const [isInitialised, setIsInitialised] = useState(false)

  // This is initial setup of reducer that holds all analysis questions with
  // responses.
  const [state, dispatch] = useReducer(analysisQuestionsReducer, initialState)
  const contextValue = useMemo(() => {
    return { state, dispatch }
  }, [state, dispatch])

  // This loads existing questions definitions and respones to build the actual
  // initial data for the reducer.
  useEffect(() => {
    dispatch({
      type: 'setQuestions',
      payload: {
        questions: applyUpdateResponseToInternalQuestions(
          questionXpath,
          supplement,
          convertQuestionsFromSchemaToInternal(advancedFeature),
        ),
      },
    })

    setIsInitialised(true)
  }, [])

  useEffect(() => {
    // The singleProcessingStore is handling navigation blocking for the whole
    // single processing route. We need to keep it up to date whether the
    // analysisQuestions.reducer has unsaved changes or not.
    singleProcessingStore.setAnalysisTabHasUnsavedChanges(state.hasUnsavedWork)
  }, [state.hasUnsavedWork])

  if (!isInitialised) {
    return (
      <div className={bodyStyles.root}>
        <LoadingSpinner message={false} />
      </div>
    )
  }

  return (
    <div className={classNames(bodyStyles.root, bodyStyles.viewAnalysis)}>
      <AnalysisQuestionsContext.Provider value={contextValue}>
        <AnalysisHeader
          asset={asset}
          questionXpath={questionXpath}
          submission={submission}
          supplement={supplement}
          advancedFeature={advancedFeature}
        />

        <AnalysisContent
          asset={asset}
          questionXpath={questionXpath}
          advancedFeature={advancedFeature}
          submission={submission}
          supplement={supplement}
        />
      </AnalysisQuestionsContext.Provider>
    </div>
  )
}
