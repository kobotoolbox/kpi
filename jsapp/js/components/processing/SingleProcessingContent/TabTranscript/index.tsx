import React from 'react'
import type { DataResponse } from '#/api/models/dataResponse'
import type { DataSupplementResponseOneOf } from '#/api/models/dataSupplementResponseOneOf'
import type {
  assetsAdvancedFeaturesListResponse,
  assetsDataSupplementRetrieveResponse,
} from '#/api/react-query/survey-data'
import type { AssetResponse } from '#/dataInterface'
import { isSupplementVersionWithValue } from '../../common/utils'
import TranscriptCreate from './TranscriptCreate'
import TranscriptEdit from './TranscriptEdit'

interface Props {
  asset: AssetResponse
  questionXpath: string
  submission: DataResponse & Record<string, string>
  onUnsavedWorkChange: (hasUnsavedWork: boolean) => void
  supplementData: assetsDataSupplementRetrieveResponse | undefined
  advancedFeaturesData: assetsAdvancedFeaturesListResponse | undefined
}

export default function TranscriptTab({
  asset,
  questionXpath,
  submission,
  onUnsavedWorkChange,
  supplementData,
  advancedFeaturesData,
}: Props) {
  const questionSupplement =
    supplementData?.status === 200 ? (supplementData.data[questionXpath] as DataSupplementResponseOneOf) : undefined

  // Backend said, that latest version is the "real version" and to discared the rest.
  // This should equal what can be found within `DataResponse._supplementalDetails`.
  // TODO: perhaps use `DataResponse._supplementalDetails` instead?
  const transcriptVersion = [
    ...(questionSupplement?.manual_transcription?._versions || []),
    ...(questionSupplement?.automatic_google_transcription?._versions || []),
  ].sort((a, b) => (a._dateCreated < b._dateCreated ? 1 : -1))[0]

  console.log('TranscriptTab', transcriptVersion)

  if (transcriptVersion && isSupplementVersionWithValue(transcriptVersion)) {
    return (
      <TranscriptEdit
        asset={asset}
        questionXpath={questionXpath}
        submission={submission}
        transcriptVersion={transcriptVersion}
        onUnsavedWorkChange={onUnsavedWorkChange}
        advancedFeaturesData={advancedFeaturesData}
      />
    )
  } else {
    return (
      <TranscriptCreate
        asset={asset}
        questionXpath={questionXpath}
        submission={submission}
        onUnsavedWorkChange={onUnsavedWorkChange}
        advancedFeaturesData={advancedFeaturesData}
      />
    )
  }
}
