import React from 'react'
import { useParams } from 'react-router-dom'
import type { _DataSupplementResponseOneOfAutomaticGoogleTranscriptionVersionsItemData } from '#/api/models/_dataSupplementResponseOneOfAutomaticGoogleTranscriptionVersionsItemData'
import type { _DataSupplementResponseOneOfAutomaticGoogleTranscriptionVersionsItemDataOneOfThree } from '#/api/models/_dataSupplementResponseOneOfAutomaticGoogleTranscriptionVersionsItemDataOneOfThree'
import type { _DataSupplementResponseOneOfManualTranscriptionVersionsItemData } from '#/api/models/_dataSupplementResponseOneOfManualTranscriptionVersionsItemData'
import type { DataResponse } from '#/api/models/dataResponse'
import type { DataSupplementResponseOneOf } from '#/api/models/dataSupplementResponseOneOf'
import {
  getAssetsDataListQueryKey,
  getAssetsDataSupplementRetrieveQueryKey,
  useAssetsDataList,
  useAssetsDataSupplementRetrieve,
} from '#/api/react-query/survey-data'
import assetStore from '#/assetStore'
import { addDefaultUuidPrefix } from '#/utils'
import TranscriptCreate from './TranscriptCreate'
import TranscriptEdit from './TranscriptEdit'

function isTranscriptDataExisting(
  transcriptData: _DataSupplementResponseOneOfAutomaticGoogleTranscriptionVersionsItemData,
): transcriptData is _DataSupplementResponseOneOfAutomaticGoogleTranscriptionVersionsItemDataOneOfThree
function isTranscriptDataExisting(
  transcriptData: Partial<_DataSupplementResponseOneOfManualTranscriptionVersionsItemData>,
): transcriptData is _DataSupplementResponseOneOfManualTranscriptionVersionsItemData & {value: string}
function isTranscriptDataExisting(
  transcriptData: _DataSupplementResponseOneOfAutomaticGoogleTranscriptionVersionsItemData | Partial<_DataSupplementResponseOneOfManualTranscriptionVersionsItemData>,
) {
  return 'value' in transcriptData && typeof transcriptData.value === 'string'
}

interface RouteParams extends Record<string, string | undefined> {
  uid: string
  xpath: string
  submissionEditId: string
}

export default function TranscriptTab() {
  const { uid, xpath, submissionEditId } = useParams<RouteParams>()

  const querySupplement = useAssetsDataSupplementRetrieve(uid!, submissionEditId!, {
    query: {
      queryKey: getAssetsDataSupplementRetrieveQueryKey(uid!, submissionEditId!),
      enabled: !!uid,
    },
  })

  const params = {
    query: JSON.stringify({
      $or: [{ 'meta/rootUuid': addDefaultUuidPrefix(submissionEditId!) }, { _uuid: submissionEditId }],
    }),
  } as any
  const querySubmission = useAssetsDataList(uid!, params, {
    query: {
      queryKey: getAssetsDataListQueryKey(uid!, params),
      enabled: !!uid,
    },
  })
  // TODO OpenAPI: DataResponse should be indexable.
  const currentSubmission =
    querySubmission.data?.status === 200 && querySubmission.data.data.results.length > 0
      ? (querySubmission.data.data.results[0] as DataResponse & Record<string, string>)
      : null

  const asset = uid !== undefined ? assetStore.getAsset(uid) : undefined

  // console.log('TranscriptTab', asset, xpath, currentSubmission)
  if (!asset) return null // TODO: better error handling
  if (!xpath) return null // TODO: better error handling
  if (!currentSubmission) return null // TODO: some spinner

  const questionSupplement =
    querySupplement.data?.status === 200
      ? (querySupplement.data.data[xpath!] as DataSupplementResponseOneOf)
      : undefined

  // Backend said, that latest version is the "real version" and to discared the rest.
  // This should equal what can be found within `DataResponse._supplementalDetails`.
  // TODO: perhaps use `DataResponse._supplementalDetails` instead?
  const transcriptVersion = [
    ...(questionSupplement?.manual_transcription?._versions || []),
    ...(questionSupplement?.automatic_google_transcription?._versions || []),
  ].sort((a, b) => (a._dateCreated < b._dateCreated ? 1 : -1))[0]

  console.log('TranscriptTab', transcriptVersion)

  if (
    transcriptVersion && !!isTranscriptDataExisting(transcriptVersion._data)
  ) {
    return <TranscriptEdit asset={asset} questionXpath={xpath} submission={currentSubmission} transcriptVersion={transcriptVersion} />
  } else {
    return <TranscriptCreate asset={asset} questionXpath={xpath} submission={currentSubmission} />
  }
}
