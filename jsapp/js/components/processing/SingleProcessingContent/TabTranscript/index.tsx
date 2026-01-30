import React, { useEffect, useState } from 'react'
import type { _DataSupplementResponseOneOfAutomaticGoogleTranscriptionVersionsItem } from '#/api/models/_dataSupplementResponseOneOfAutomaticGoogleTranscriptionVersionsItem'
import type { AdvancedFeatureResponse } from '#/api/models/advancedFeatureResponse'
import type { DataResponse } from '#/api/models/dataResponse'
import type { DataSupplementResponse } from '#/api/models/dataSupplementResponse'
import type { AssetResponse } from '#/dataInterface'
import {
  getLatestTranscriptVersionItem,
  isSupplementVersionAutomatic,
  isSupplementVersionWithValue,
} from '../../common/utils'
import TranscriptCreate from './TranscriptCreate'
import AutomaticTranscriptionInProgress from './TranscriptCreate/AutomaticTranscriptionInProgress'
import TranscriptEdit from './TranscriptEdit'

type VersionOfAutomaticTranscript = _DataSupplementResponseOneOfAutomaticGoogleTranscriptionVersionsItem

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
  const [isTranscribing, setIsTranscribing] = useState(false)
  const transcriptVersion = getLatestTranscriptVersionItem(supplement, questionXpath)

  useEffect(() => {
    if (isTranscribing && transcriptVersion && isSupplementVersionWithValue(transcriptVersion)) {
      setIsTranscribing(false)
    }
  }, [isTranscribing, transcriptVersion])

  if (
    transcriptVersion &&
    isSupplementVersionAutomatic(transcriptVersion) &&
    (isTranscribing || (transcriptVersion as VersionOfAutomaticTranscript)?._data?.status === 'in_progress')
  ) {
    return <AutomaticTranscriptionInProgress asset={asset} questionXpath={questionXpath} submission={submission} />
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
  } else {
    return (
      <TranscriptCreate
        asset={asset}
        questionXpath={questionXpath}
        submission={submission}
        supplement={supplement}
        onUnsavedWorkChange={onUnsavedWorkChange}
        advancedFeatures={advancedFeatures}
        setIsTranscribing={setIsTranscribing}
      />
    )
  }
}
