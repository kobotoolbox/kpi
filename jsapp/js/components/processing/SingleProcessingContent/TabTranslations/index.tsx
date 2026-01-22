import React, { useEffect, useState } from 'react'
import type { AdvancedFeatureResponse } from '#/api/models/advancedFeatureResponse'
import type { DataResponse } from '#/api/models/dataResponse'
import type { DataSupplementResponse } from '#/api/models/dataSupplementResponse'
import type { LanguageCode } from '#/components/languages/languagesStore'
import type { AssetResponse } from '#/dataInterface'
import bodyStyles from '../../common/processingBody.module.scss'
import { getAllTranslationsFromSupplementData } from '../../common/utils'
import TranslationAdd from './TranslationAdd'
import Editor from './TranslationEdit/Editor'
import Viewer from './TranslationEdit/Viewer'

interface Props {
  asset: AssetResponse
  questionXpath: string
  submission: DataResponse
  onUnsavedWorkChange: (hasUnsavedWork: boolean) => void
  supplement: DataSupplementResponse
  advancedFeatures: AdvancedFeatureResponse[]
}

export default function TranslationTab({
  asset,
  questionXpath,
  submission,
  onUnsavedWorkChange,
  supplement,
  advancedFeatures,
}: Props) {
  const translationVersions = getAllTranslationsFromSupplementData(supplement, questionXpath)

  // Selected language Code to display.
  const [languageCode, setLanguageCode] = useState<LanguageCode | null>(null)
  const translationVersion = translationVersions.find(({ _data }) => _data.language === languageCode)

  useEffect(() => {
    if (translationVersion) return
    setLanguageCode(translationVersions[0]?._data.language ?? null)
  }, [translationVersion, setLanguageCode, translationVersions])

  // If automatic transcript isn't accepted, go directly to edit mode to accept or edit it.
  const [_mode, setMode] = useState<'view' | 'edit' | 'add'>('view')
  const mode = translationVersions.length > 0 ? _mode : 'add'

  // I wonder what's the userflow to end up in the edit view to accept unaccepted translation.
  // The difference is that now unaccepted translations persist beyond user leaving the screen.
  // Potentially, there may be multiple unaccepted translations.
  // I *guess* that to keep it simple, we should force edit view upon the user for the unaccepted translation,
  // and thus forbidding to create another unaccepted translations.
  // TODO: Handle acceptable user flow.

  return (
    <>
      {(mode === 'add' || !translationVersion) && (
        <TranslationAdd
          asset={asset}
          questionXpath={questionXpath}
          submission={submission}
          languagesExisting={translationVersions.map(({ _data }) => _data.language)}
          initialStep={translationVersion ? 'language' : 'begin'}
          onCreate={(languageCode: LanguageCode) => {
            // TODO: I can't get it working so that it sets the newly created language the selected one.
            // must be some race condition between query fetching new supplements and checks above checking for nulls.
            setMode('view')
            setLanguageCode(languageCode)
          }}
          onUnsavedWorkChange={onUnsavedWorkChange}
          advancedFeatures={advancedFeatures}
        />
      )}
      {mode === 'view' && translationVersion && (
        <div className={bodyStyles.root}>
          <Viewer
            asset={asset}
            questionXpath={questionXpath}
            submission={submission}
            translationVersion={translationVersion}
            translationVersions={translationVersions}
            onEdit={() => setMode('edit')}
            onAdd={() => setMode('add')}
            onChangeLanguageCode={(languageCode: LanguageCode) => setLanguageCode(languageCode)}
          />
        </div>
      )}
      {mode === 'edit' && translationVersion && (
        <div className={bodyStyles.root}>
          <Editor
            asset={asset}
            questionXpath={questionXpath}
            submission={submission}
            translationVersion={translationVersions.find(({ _data }) => _data.language === languageCode)!}
            onBack={() => setMode('view')}
            onSave={() => setMode('view')}
            onUnsavedWorkChange={onUnsavedWorkChange}
            advancedFeatures={advancedFeatures}
          />
        </div>
      )}
    </>
  )
}
