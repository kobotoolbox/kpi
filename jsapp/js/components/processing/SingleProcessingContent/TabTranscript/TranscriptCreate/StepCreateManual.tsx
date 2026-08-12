import cx from 'classnames'
import React from 'react'
import type { AdvancedFeatureResponse } from '#/api/models/advancedFeatureResponse'
import type { BulkActionResponse } from '#/api/models/bulkActionResponse'
import type { DataResponse } from '#/api/models/dataResponse'
import type { DataSupplementResponse } from '#/api/models/dataSupplementResponse'
import type { LanguageCode } from '#/components/languages/languagesStore'
import type { AssetResponse } from '#/dataInterface'
import bodyStyles from '../../../common/processingBody.module.scss'
import Editor from '../TranscriptEdit/Editor'

interface Props {
  asset: AssetResponse
  questionXpath: string
  submission: DataResponse
  supplement: DataSupplementResponse
  activeBulkActions: BulkActionResponse[]
  languageCode: LanguageCode
  onBack: () => void
  onUnsavedWorkChange: (hasUnsavedWork: boolean) => void
  advancedFeatures: AdvancedFeatureResponse[]
}

export default function StepCreateManual({
  asset,
  questionXpath,
  submission,
  supplement,
  activeBulkActions,
  languageCode,
  onBack,
  onUnsavedWorkChange,
  advancedFeatures,
}: Props) {
  return (
    <div className={cx(bodyStyles.root)}>
      <Editor
        asset={asset}
        questionXpath={questionXpath}
        submission={submission}
        supplement={supplement}
        activeBulkActions={activeBulkActions}
        transcriptVersion={{
          _uuid: '',
          _dateCreated: '',
          _dateAccepted: '',
          _data: { language: languageCode, value: null },
        }}
        onBack={onBack}
        onUnsavedWorkChange={onUnsavedWorkChange}
        advancedFeatures={advancedFeatures}
      />
    </div>
  )
}
