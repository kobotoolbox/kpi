import React, { useState } from 'react'

import classNames from 'classnames'
import { ActionEnum } from '#/api/models/actionEnum'
import type { AdvancedFeatureResponse } from '#/api/models/advancedFeatureResponse'
import type { DataResponse } from '#/api/models/dataResponse'
import type { DataSupplementResponse } from '#/api/models/dataSupplementResponse'
import type { ResponseManualQualActionParams } from '#/api/models/responseManualQualActionParams'
import { useAssetsAdvancedFeaturesCreate } from '#/api/react-query/survey-data'
import type { AssetResponse } from '#/dataInterface'
import bodyStyles from '../../common/processingBody.module.scss'
import AnalysisContent from './AnalysisContent'
import AnalysisHeader from './AnalysisHeader'
import type { AdvancedFeatureResponseManualQual } from './common/utils'

interface Props {
  asset: AssetResponse
  questionXpath: string
  submission: DataResponse
  onUnsavedWorkChange: (hasUnsavedWork: boolean) => void
  supplement: DataSupplementResponse
  advancedFeatures: AdvancedFeatureResponse[]
}

/**
 * Displays content of the "Analysis" tab. This component is handling all of
 * the Qualitative Analysis functionality.
 */
export default function AnalysisTab({ asset, questionXpath, submission, supplement, advancedFeatures }: Props) {
  const [qaQuestion, setQaQuestion] = useState<ResponseManualQualActionParams | undefined>(undefined)

  // Mutation for creating manual_qual advanced feature
  const createAdvancedFeatureMutation = useAssetsAdvancedFeaturesCreate()

  // Filter to get the manual_qual advanced feature for this question
  const advancedFeature = advancedFeatures.find(
    (feature) => feature.action === ActionEnum.manual_qual && feature.question_xpath === questionXpath,
  ) as AdvancedFeatureResponseManualQual | undefined

  // Create the manual_qual advanced feature if it doesn't exist
  const enableAdvancedFeatureManualQual = async () => {
    if (advancedFeature) return

    await createAdvancedFeatureMutation.mutateAsync({
      uidAsset: asset.uid,
      data: {
        action: ActionEnum.manual_qual,
        question_xpath: questionXpath,
        params: [],
      },
    })
  }

  const handleSetQaQuestion = async (qaQuestion: ResponseManualQualActionParams | undefined) => {
    await enableAdvancedFeatureManualQual()
    setQaQuestion(qaQuestion)
  }

  return (
    <div className={classNames(bodyStyles.root, bodyStyles.viewAnalysis)}>
      <AnalysisHeader
        asset={asset}
        questionXpath={questionXpath}
        submission={submission}
        supplement={supplement}
        advancedFeatures={advancedFeatures}
        qaQuestion={qaQuestion}
        setQaQuestion={handleSetQaQuestion}
      />

      <AnalysisContent
        asset={asset}
        questionXpath={questionXpath}
        advancedFeatures={advancedFeatures}
        submission={submission}
        supplement={supplement}
        qaQuestion={qaQuestion}
        setQaQuestion={handleSetQaQuestion}
      />
    </div>
  )
}
