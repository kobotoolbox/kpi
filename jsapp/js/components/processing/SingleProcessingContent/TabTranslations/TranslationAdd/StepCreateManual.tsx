import cx from 'classnames'
import React from 'react'
import type { AdvancedFeatureResponse } from '#/api/models/advancedFeatureResponse'
import type { DataResponse } from '#/api/models/dataResponse'
import type { DataSupplementResponse } from '#/api/models/dataSupplementResponse'
import type { LanguageCode } from '#/components/languages/languagesStore'
import type { AssetResponse } from '#/dataInterface'
import bodyStyles from '../../../common/processingBody.module.scss'
import Editor from '../TranslationEdit/Editor'

interface Props {
  asset: AssetResponse
  questionXpath: string
  submission: DataResponse
  supplement: DataSupplementResponse
  languageCode: LanguageCode
  onBack: () => void
  onCreate: (languageCode: LanguageCode, context: 'automated' | 'manual') => void
  onUnsavedWorkChange: (hasUnsavedWork: boolean) => void
  advancedFeatures: AdvancedFeatureResponse[]
}

export default function StepCreateManual({
  asset,
  questionXpath,
  submission,
  supplement,
  languageCode,
  onBack,
  onCreate,
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
        translationVersion={{
          _uuid: '',
          _dateCreated: '',
          _dateAccepted: '',
          _data: { language: languageCode, value: null },
          _dependency: { _actionId: '', _uuid: '' },
        }}
        onBack={onBack}
        onSave={() => onCreate(languageCode, 'manual')}
        onUnsavedWorkChange={onUnsavedWorkChange}
        advancedFeatures={advancedFeatures}
      />
    </div>
  )
}
