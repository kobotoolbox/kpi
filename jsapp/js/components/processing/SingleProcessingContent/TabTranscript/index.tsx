import React from 'react'
import type { AdvancedFeatureResponse } from '#/api/models/advancedFeatureResponse'
import type { DataResponse } from '#/api/models/dataResponse'
import type { DataSupplementResponse } from '#/api/models/dataSupplementResponse'
import type { AssetResponse } from '#/dataInterface'
import { getLatestTranscriptVersionItem, isSupplementVersionWithValue } from '../../common/utils'
import TranscriptCreate from './TranscriptCreate'
import TranscriptEdit from './TranscriptEdit'

interface Props {
  asset: AssetResponse
  questionXpath: string
  submission: DataResponse
  onUnsavedWorkChange: (hasUnsavedWork: boolean) => void
  supplement: DataSupplementResponse
  advancedFeatures: AdvancedFeatureResponse[]
}

export default function TranscriptTab({
  asset,
  questionXpath,
  submission,
  onUnsavedWorkChange,
  supplement,
  advancedFeatures,
}: Props) {
  const transcriptVersion = getLatestTranscriptVersionItem(supplement, questionXpath)

  if (transcriptVersion && isSupplementVersionWithValue(transcriptVersion)) {
    return (
      <TranscriptEdit
        asset={asset}
        questionXpath={questionXpath}
        submission={submission}
        transcriptVersion={transcriptVersion}
        onUnsavedWorkChange={onUnsavedWorkChange}
        advancedFeatures={advancedFeatures}
      />
    )
  } else {
    return (
      <TranscriptCreate
        asset={asset}
        questionXpath={questionXpath}
        submission={submission}
        onUnsavedWorkChange={onUnsavedWorkChange}
        advancedFeatures={advancedFeatures}
      />
    )
  }
}
