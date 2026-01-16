import React, { useState } from 'react'
import type { _DataSupplementResponseOneOfOneOfAutomaticGoogleTranscriptionVersionsItem } from '#/api/models/_dataSupplementResponseOneOfOneOfAutomaticGoogleTranscriptionVersionsItem'
import type { _DataSupplementResponseOneOfOneOfManualTranscriptionVersionsItem } from '#/api/models/_dataSupplementResponseOneOfOneOfManualTranscriptionVersionsItem'
import type { DataResponse } from '#/api/models/dataResponse'
import type { AssetResponse } from '#/dataInterface'
import bodyStyles from '../../../common/processingBody.module.scss'
import { isTranscriptVersionAutomatic } from '../common/utils'
import Editor from './Editor'
import Viewer from './Viewer'

interface Props {
  asset: AssetResponse
  questionXpath: string
  submission: DataResponse
  transcriptVersion:
    | _DataSupplementResponseOneOfOneOfManualTranscriptionVersionsItem
    | _DataSupplementResponseOneOfOneOfAutomaticGoogleTranscriptionVersionsItem
}

export default function TranscriptEdit({ asset, questionXpath, submission, transcriptVersion }: Props) {
  // If automatic transcript isn't accepted, go directly to edit mode to accept or edit it.
  const [mode, setMode] = useState<'view' | 'edit'>(() => isTranscriptVersionAutomatic(transcriptVersion) && !transcriptVersion._dateAccepted ? 'edit' : 'view')

  return (
    <div className={bodyStyles.root}>
      {mode === 'view' ? (
        <Viewer
          asset={asset}
          questionXpath={questionXpath}
          submission={submission}
          transcriptVersion={transcriptVersion}
          onEdit={() => setMode('edit')}
        />
      ) : (
        <Editor
          asset={asset}
          questionXpath={questionXpath}
          submission={submission}
          transcriptVersion={transcriptVersion}
          onBack={() => setMode('view')}
        />
      )}
    </div>
  )
}
