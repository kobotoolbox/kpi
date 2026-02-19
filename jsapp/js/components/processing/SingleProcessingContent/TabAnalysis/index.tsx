import React, { useState } from 'react'

import classNames from 'classnames'
import { ActionEnum } from '#/api/models/actionEnum'
import type { AdvancedFeatureResponse } from '#/api/models/advancedFeatureResponse'
import type { DataResponse } from '#/api/models/dataResponse'
import type { DataSupplementResponse } from '#/api/models/dataSupplementResponse'
import type { ResponseQualActionParams } from '#/api/models/responseQualActionParams'
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
  const [qaQuestion, setQaQuestion] = useState<ResponseQualActionParams | undefined>(undefined)

  // Filter to get the manual_qual advanced feature for this question
  const advancedFeature = advancedFeatures.find(
    (feature) => feature.action === ActionEnum.manual_qual && feature.question_xpath === questionXpath,
  ) as AdvancedFeatureResponseManualQual | undefined

  // If no manual_qual feature exists, we can't render the analysis tab
  if (!advancedFeature) {
    return null
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
        setQaQuestion={setQaQuestion}
      />

      <AnalysisContent
        asset={asset}
        questionXpath={questionXpath}
        advancedFeatures={advancedFeatures}
        submission={submission}
        supplement={supplement}
        qaQuestion={qaQuestion}
        setQaQuestion={setQaQuestion}
      />
    </div>
  )
}
