import React, { useState } from 'react'
import type { AdvancedFeatureResponse } from '#/api/models/advancedFeatureResponse'
import type { DataResponse } from '#/api/models/dataResponse'
import type { DataSupplementResponse } from '#/api/models/dataSupplementResponse'
import type { TranscriptVersionItem } from '#/components/processing/common/types'
import { isSupplementVersionAutomatic } from '#/components/processing/common/utils'
import type { AssetResponse } from '#/dataInterface'
import bodyStyles from '../../../common/processingBody.module.scss'
import Editor from './Editor'
import Viewer from './Viewer'

interface Props {
  asset: AssetResponse
  questionXpath: string
  submission: DataResponse
  supplement: DataSupplementResponse
  transcriptVersion: TranscriptVersionItem
  onUnsavedWorkChange: (hasUnsavedWork: boolean) => void
  advancedFeatures: AdvancedFeatureResponse[]
}

export default function TranscriptEdit({
  asset,
  questionXpath,
  submission,
  supplement,
  transcriptVersion,
  onUnsavedWorkChange,
  advancedFeatures,
}: Props) {
  // If automatic transcript isn't accepted, go directly to edit mode to accept or edit it.
  const [mode, setMode] = useState<'view' | 'edit'>(() =>
    isSupplementVersionAutomatic(transcriptVersion) && !transcriptVersion._dateAccepted ? 'edit' : 'view',
  )

  return (
    <div className={bodyStyles.root}>
      {mode === 'view' ? (
        <Viewer
          asset={asset}
          questionXpath={questionXpath}
          submission={submission}
          supplement={supplement}
          transcriptVersion={transcriptVersion}
          onEdit={() => setMode('edit')}
        />
      ) : (
        <Editor
          asset={asset}
          questionXpath={questionXpath}
          submission={submission}
          supplement={supplement}
          transcriptVersion={transcriptVersion}
          onBack={() => setMode('view')}
          onSave={() => setMode('view')}
          onUnsavedWorkChange={onUnsavedWorkChange}
          advancedFeatures={advancedFeatures}
        />
      )}
    </div>
  )
}
