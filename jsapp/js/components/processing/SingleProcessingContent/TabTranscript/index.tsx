import React from 'react'

import { useParams } from 'react-router-dom'
import type { DataSupplementResponseOneOfOneOf } from '#/api/models/dataSupplementResponseOneOfOneOf'
import { getAssetsDataSupplementRetrieveQueryKey, useAssetsDataSupplementRetrieve } from '#/api/react-query/survey-data'
import StepConfig from './stepConfig'
import StepEditor from './stepEditor'
import StepViewer from './stepViewer'

// TODO OpenAPI: DataSupplementResponseOneOf should be obj, not obj | string.
// TODO: OpenAPI: _DataSupplementResponseOneOfOneOfManualTranscriptionVersionsItemData should have `locale?: string` prop.
// TODO OpenAPI: _DataSupplementResponseOneOfOneOfManualTranscriptionVersionsItemData.language should be an enum?

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

  const questionSupplement = querySupplement.data?.status === 200 ?
      (querySupplement.data.data[xpath!] as DataSupplementResponseOneOfOneOf) : undefined
  const transcripts = questionSupplement?.manual_transcription?._versions || []
  const transcript = transcripts.find((transcript) => transcript._data.value !== null && !!transcript._dateAccepted)
  const draft = transcripts.find((transcript) => transcript._data.value !== null && !transcript._dateAccepted)

  if (draft) {
    return <StepEditor draft={draft} />
  }
  if (transcript) {
    return <StepViewer transcript={transcript} />
  }

  return <StepConfig />
}
