import React, { useState } from 'react'

import classNames from 'classnames'
import type { DataResponse } from '#/api/models/dataResponse'
import type { DataSupplementResponse } from '#/api/models/dataSupplementResponse'
import type { ResponseManualQualActionParams } from '#/api/models/responseManualQualActionParams'
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
  advancedFeature: AdvancedFeatureResponseManualQual
}

/**
 * Displays content of the "Analysis" tab. This component is handling all of
 * the Qualitative Analysis functionality.
 */
export default function AnalysisTab({ asset, questionXpath, submission, supplement, advancedFeature }: Props) {
  const [qaQuestion, setQaQuestion] = useState<ResponseManualQualActionParams | undefined>(undefined)

  return (
    <div className={classNames(bodyStyles.root, bodyStyles.viewAnalysis)}>
      <AnalysisHeader
        asset={asset}
        questionXpath={questionXpath}
        submission={submission}
        supplement={supplement}
        advancedFeature={advancedFeature}
        qaQuestion={qaQuestion}
        setQaQuestion={setQaQuestion}
      />

      <AnalysisContent
        asset={asset}
        questionXpath={questionXpath}
        advancedFeature={advancedFeature}
        submission={submission}
        supplement={supplement}
        qaQuestion={qaQuestion}
        setQaQuestion={setQaQuestion}
      />
    </div>
  )
}
