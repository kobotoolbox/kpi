import React from 'react'
import type { DataResponse } from '#/api/models/dataResponse'
import type { assetsAdvancedFeaturesListResponse } from '#/api/react-query/survey-data'
import type { LanguageCode } from '#/components/languages/languagesStore'
import type { AssetResponse } from '#/dataInterface'
import Editor from '../TranslationEdit/Editor'

interface Props {
  asset: AssetResponse
  questionXpath: string
  submission: DataResponse & Record<string, string>
  languageCode: LanguageCode
  onBack: () => void
  onCreate: (languageCode: LanguageCode) => void
  onUnsavedWorkChange: (hasUnsavedWork: boolean) => void
  advancedFeaturesData: assetsAdvancedFeaturesListResponse | undefined
}

/**
 * TODO: wrap Editor and display it.
 */

export default function StepCreateManual({
  asset,
  questionXpath,
  submission,
  languageCode,
  onBack,
  onCreate,
  onUnsavedWorkChange,
  advancedFeaturesData,
}: Props) {
  // TODO: fix styles
  return (
    <Editor
      asset={asset}
      questionXpath={questionXpath}
      submission={submission}
      translationVersion={{
        _uuid: '',
        _dateCreated: '',
        _dateAccepted: '',
        _data: { language: languageCode, value: null },
      }}
      onBack={onBack}
      onSave={() => onCreate(languageCode)}
      onUnsavedWorkChange={onUnsavedWorkChange}
      advancedFeaturesData={advancedFeaturesData}
    />
  )
}
