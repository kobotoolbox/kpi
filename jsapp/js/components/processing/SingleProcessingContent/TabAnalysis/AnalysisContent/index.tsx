import React from 'react'
import type { DataResponse } from '#/api/models/dataResponse'
import type { DataSupplementResponse } from '#/api/models/dataSupplementResponse'
import type { AssetResponse } from '#/dataInterface'
import type { AdvancedFeatureResponseManualQual } from '../common/utils'
import AnalysisQuestionsList from './AnalysisQuestionsList'
import AnalysisContentEmpty from './analysisContentEmpty'
import styles from './index.module.scss'

interface Props {
  asset: AssetResponse
  questionXpath: string
  advancedFeature: AdvancedFeatureResponseManualQual
  submission: DataResponse & Record<string, string>
  supplement: DataSupplementResponse
}

/** Displays either a special message for no content, or the list of questions. */
export default function AnalysisContent({ asset, questionXpath, advancedFeature, submission }: Props) {
  return (
    <section className={styles.root}>
      {advancedFeature.params.length === 0 && <AnalysisContentEmpty asset={asset} />}

      {advancedFeature.params.length > 0 && (
        <AnalysisQuestionsList
          asset={asset}
          advancedFeature={advancedFeature}
          questionXpath={questionXpath}
          submission={submission}
        />
      )}
    </section>
  )
}
