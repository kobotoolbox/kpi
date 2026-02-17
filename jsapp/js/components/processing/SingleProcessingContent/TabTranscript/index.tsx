import React from 'react'
import type { AdvancedFeatureResponse } from '#/api/models/advancedFeatureResponse'
import type { DataResponse } from '#/api/models/dataResponse'
import type { DataSupplementResponse } from '#/api/models/dataSupplementResponse'
import type { SupplementalDataVersionItemAutomatic } from '#/api/models/supplementalDataVersionItemAutomatic'
import type { AssetResponse } from '#/dataInterface'
import {
  getLatestTranscriptVersionItem,
  isSupplementVersionAutomatic,
  isSupplementVersionWithValue,
} from '../../common/utils'
import TranscriptCreate from './TranscriptCreate'
import TranscriptEdit from './TranscriptEdit'
import TranscriptPoll from './TranscriptPoll'

type VersionOfAutomaticTranscript = SupplementalDataVersionItemAutomatic

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

  if (
    transcriptVersion &&
    isSupplementVersionAutomatic(transcriptVersion) &&
    (transcriptVersion as VersionOfAutomaticTranscript)?._data?.status === 'in_progress'
  ) {
    return <TranscriptPoll asset={asset} questionXpath={questionXpath} submission={submission} />
  }
  if (transcriptVersion && isSupplementVersionWithValue(transcriptVersion)) {
    return (
      <TranscriptEdit
        asset={asset}
        questionXpath={questionXpath}
        submission={submission}
        supplement={supplement}
        transcriptVersion={transcriptVersion}
        onUnsavedWorkChange={onUnsavedWorkChange}
        advancedFeatures={advancedFeatures}
      />
    )
  }

  return (
    <TranscriptCreate
      asset={asset}
      questionXpath={questionXpath}
      submission={submission}
      supplement={supplement}
      onUnsavedWorkChange={onUnsavedWorkChange}
      advancedFeatures={advancedFeatures}
    />
  )
}
