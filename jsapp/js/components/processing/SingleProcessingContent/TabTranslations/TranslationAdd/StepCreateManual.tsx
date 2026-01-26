import cx from 'classnames'
import React from 'react'
import type { AdvancedFeatureResponse } from '#/api/models/advancedFeatureResponse'
import type { DataResponse } from '#/api/models/dataResponse'
import type { LanguageCode } from '#/components/languages/languagesStore'
import type { AssetResponse } from '#/dataInterface'
import bodyStyles from '../../../common/processingBody.module.scss'
import Editor from '../TranslationEdit/Editor'

interface Props {
  asset: AssetResponse
  questionXpath: string
  submission: DataResponse
  languageCode: LanguageCode
  onBack: () => void
  onCreate: (languageCode: LanguageCode) => void
  onUnsavedWorkChange: (hasUnsavedWork: boolean) => void
  advancedFeatures: AdvancedFeatureResponse[]
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
  advancedFeatures,
}: Props) {
  return (
    <div className={cx(bodyStyles.root)}>
      {/*
      TODO PRESELECT BUG: after creating 2nd (and further) translation, we end up always viewing the 1st translation
      instead of the one just created. E.g. I have "Spanish" translation, I start adding new translation, choose
      "Polish", type something and click "Save". When saving finishes, I end up viewing "Spanish" instead of "Polish".
      */}
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
        advancedFeatures={advancedFeatures}
      />
    </div>
  )
}
