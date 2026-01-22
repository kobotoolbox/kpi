import React from 'react'
import type { DataResponse } from '#/api/models/dataResponse'
import type { DataSupplementResponse } from '#/api/models/dataSupplementResponse'
import type { QualActionParams } from '#/api/models/qualActionParams'
import type { AssetResponse } from '#/dataInterface'
import type { AdvancedFeatureResponseManualQual } from '../common/utils'
import AnalysisQuestionsList from './AnalysisQuestionsList'
import AnalysisContentEmpty from './analysisContentEmpty'
import styles from './index.module.scss'

interface Props {
  asset: AssetResponse
  questionXpath: string
  advancedFeature: AdvancedFeatureResponseManualQual
  submission: DataResponse
  supplement: DataSupplementResponse
  qaQuestion?: QualActionParams
  setQaQuestion: (qaQuestion: QualActionParams | undefined) => void
}

/** Displays either a special message for no content, or the list of questions. */
export default function AnalysisContent({
  asset,
  questionXpath,
  advancedFeature,
  submission,
  qaQuestion,
  setQaQuestion,
}: Props) {
  return (
    <section className={styles.root}>
      {!qaQuestion && advancedFeature.params.length === 0 && <AnalysisContentEmpty asset={asset} />}

      {(qaQuestion || advancedFeature.params.length > 0) && (
        <AnalysisQuestionsList
          asset={asset}
          advancedFeature={advancedFeature}
          questionXpath={questionXpath}
          submission={submission}
          qaQuestion={qaQuestion}
          setQaQuestion={setQaQuestion}
        />
      )}
    </section>
  )
}
