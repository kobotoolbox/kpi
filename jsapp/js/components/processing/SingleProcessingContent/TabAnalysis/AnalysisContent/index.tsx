import React from 'react'
import { ActionEnum } from '#/api/models/actionEnum'
import type { AdvancedFeatureResponse } from '#/api/models/advancedFeatureResponse'
import type { DataResponse } from '#/api/models/dataResponse'
import type { DataSupplementResponse } from '#/api/models/dataSupplementResponse'
import type { ResponseManualQualActionParams } from '#/api/models/responseManualQualActionParams'
import type { AssetResponse } from '#/dataInterface'
import type { AdvancedFeatureResponseManualQual } from '../common/utils'
import AnalysisQuestionsList from './AnalysisQuestionsList'
import AnalysisContentEmpty from './analysisContentEmpty'
import styles from './index.module.scss'

interface Props {
  asset: AssetResponse
  questionXpath: string
  advancedFeatures: AdvancedFeatureResponse[]
  submission: DataResponse
  supplement: DataSupplementResponse
  qaQuestion?: ResponseManualQualActionParams
  setQaQuestion: (qaQuestion: ResponseManualQualActionParams | undefined) => void
}

/** Displays either a special message for no content, or the list of questions. */
export default function AnalysisContent({
  asset,
  questionXpath,
  advancedFeatures,
  submission,
  qaQuestion,
  setQaQuestion,
}: Props) {
  // Filter to get the manual_qual advanced feature for this question
  const advancedFeature = advancedFeatures.find(
    (feature) => feature.action === ActionEnum.manual_qual && feature.question_xpath === questionXpath,
  ) as AdvancedFeatureResponseManualQual | undefined

  const hasQuestions = (advancedFeature?.params?.length ?? 0) > 0

  return (
    <section className={styles.root}>
      {!qaQuestion && !hasQuestions && <AnalysisContentEmpty asset={asset} />}

      {(qaQuestion || hasQuestions) && (
        <AnalysisQuestionsList
          asset={asset}
          advancedFeatures={advancedFeatures}
          questionXpath={questionXpath}
          submission={submission}
          qaQuestion={qaQuestion}
          setQaQuestion={setQaQuestion}
        />
      )}
    </section>
  )
}
