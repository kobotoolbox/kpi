import React from 'react'
import type { DataResponse } from '#/api/models/dataResponse'
import type { DataSupplementResponseOneOf } from '#/api/models/dataSupplementResponseOneOf'
import { getAssetsDataSupplementRetrieveQueryKey, useAssetsDataSupplementRetrieve } from '#/api/react-query/survey-data'
import type { AssetResponse } from '#/dataInterface'
import { isSupplementVersionWithValue } from '../../common/utils'
import TranscriptCreate from './TranscriptCreate'
import TranscriptEdit from './TranscriptEdit'

interface Props {
  asset: AssetResponse
  questionXpath: string
  submission: DataResponse & Record<string, string>
  submissionEditId: string
  onUnsavedWorkChange: (hasUnsavedWork: boolean) => void
}

export default function TranscriptTab({
  asset,
  questionXpath,
  submission,
  submissionEditId,
  onUnsavedWorkChange,
}: Props) {
  const querySupplement = useAssetsDataSupplementRetrieve(asset.uid, submissionEditId, {
    query: {
      queryKey: getAssetsDataSupplementRetrieveQueryKey(asset.uid, submissionEditId),
      enabled: !!asset.uid,
    },
  })

  const questionSupplement =
    querySupplement.data?.status === 200
      ? (querySupplement.data.data[questionXpath] as DataSupplementResponseOneOf)
      : undefined

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
      />
    )
  } else {
    return (
      <TranscriptCreate
        asset={asset}
        questionXpath={questionXpath}
        submission={submission}
        onUnsavedWorkChange={onUnsavedWorkChange}
      />
    )
  }
}
