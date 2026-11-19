import cx from 'classnames'
import React from 'react'
import type { AdvancedFeatureResponse } from '#/api/models/advancedFeatureResponse'
import type { BulkActionResponse } from '#/api/models/bulkActionResponse'
import type { DataResponse } from '#/api/models/dataResponse'
import type { DataSupplementResponse } from '#/api/models/dataSupplementResponse'
import type { LanguageCode } from '#/components/languages/languagesStore'
import type { TranslationSource } from '#/components/processing/common/types'
import { getTranslationSourcePayload } from '#/components/processing/common/utils'
import type { AssetResponse } from '#/dataInterface'
import bodyStyles from '../../../common/processingBody.module.scss'
import Editor from '../TranslationEdit/Editor'

interface Props {
  asset: AssetResponse
  questionXpath: string
  submission: DataResponse
  supplement: DataSupplementResponse
  activeBulkActions: BulkActionResponse[]
  languageCode: LanguageCode
  /** The language of a text response, see `StepSelectLanguage` */
  source?: TranslationSource
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
  activeBulkActions,
  languageCode,
  source,
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
        activeBulkActions={activeBulkActions}
        translationVersion={{
          _uuid: '',
          _dateCreated: '',
          _dateAccepted: '',
          // The editor saves the source language along with the translation
          _data: {
            language: languageCode,
            value: null,
            ...getTranslationSourcePayload(source?.languageCode, source?.locale),
          },
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
