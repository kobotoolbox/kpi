import cx from 'classnames'
import React from 'react'
import type { DataResponse } from '#/api/models/dataResponse'
import type { assetsAdvancedFeaturesListResponse } from '#/api/react-query/survey-data'
import type { LanguageCode } from '#/components/languages/languagesStore'
import type { AssetResponse } from '#/dataInterface'
import bodyStyles from '../../../common/processingBody.module.scss'
import Editor from '../TranscriptEdit/Editor'

interface Props {
  asset: AssetResponse
  questionXpath: string
  submission: DataResponse & Record<string, string>
  languageCode: LanguageCode
  onBack: () => void
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
  onUnsavedWorkChange,
  advancedFeaturesData,
}: Props) {
  return (
    <div className={cx(bodyStyles.root)}>
      {/*
      TODO: BUG upon clicking "save" when creating transcript, the language selector blinks for a moment.
      We should rather display some spinner
      */}
      <Editor
        asset={asset}
        questionXpath={questionXpath}
        submission={submission}
        transcriptVersion={{
          _uuid: '',
          _dateCreated: '',
          _dateAccepted: '',
          _data: { language: languageCode, value: null },
        }}
        onBack={onBack}
        onUnsavedWorkChange={onUnsavedWorkChange}
        advancedFeaturesData={advancedFeaturesData}
      />
    </div>
  )
}
