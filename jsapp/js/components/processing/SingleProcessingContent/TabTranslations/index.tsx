import React, { useEffect, useState } from 'react'
import type { AdvancedFeatureResponse } from '#/api/models/advancedFeatureResponse'
import type { DataResponse } from '#/api/models/dataResponse'
import type { DataSupplementResponse } from '#/api/models/dataSupplementResponse'
import type { LanguageCode } from '#/components/languages/languagesStore'
import type { AssetResponse } from '#/dataInterface'
import bodyStyles from '../../common/processingBody.module.scss'
import { CreateSteps } from '../../common/types'
import {
  getAllTranslationsFromSupplementData,
  getLatestAutomaticTranslationVersionItem,
  isSupplementVersionAutomatic,
} from '../../common/utils'
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
  const translationVersions = getAllTranslationsFromSupplementData(supplement, questionXpath, false)

  // Selected language code to display.
  const [languageCode, setLanguageCode] = useState<LanguageCode | null>(null)
  const translationVersion = translationVersions.find(({ _data }) => _data.language === languageCode)

  useEffect(() => {
    if (translationVersion) return
    // Get latest translation if current selected is not available
    const latestTranslation = getLatestAutomaticTranslationVersionItem(supplement, questionXpath, undefined, false)
    if (!latestTranslation) {
      setLanguageCode(null)
      return
    }
    setLanguageCode(latestTranslation?._data.language ?? null)
  }, [translationVersion, setLanguageCode, supplement, questionXpath])

  const [_mode, setMode] = useState<'view' | 'edit' | 'add'>('view')
  const mode = (() => {
    if (translationVersion && isSupplementVersionAutomatic(translationVersion) && !translationVersion._dateAccepted) {
      // If automatic translation isn't accepted, go directly to edit mode to accept or edit it.
      return 'edit'
    } else if (translationVersions.length === 0) {
      // If there are no translations go directly to add mode
      return 'add'
    } else {
      // Otherwise default to whatever user action lead to
      return _mode
    }
  })()

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
          supplement={supplement}
          languagesExisting={translationVersions.map(({ _data }) => _data.language)}
          initialStep={translationVersion ? CreateSteps.Language : CreateSteps.Begin}
          translationVersions={translationVersions}
          onCreate={(languageCode: LanguageCode, context: 'automated' | 'manual') => {
            // After creating automated translation, go straight into 'edit' mode
            if (context === 'automated') {
              setMode('edit')
            } else {
              setMode('view')
            }
            setLanguageCode(languageCode)
          }}
          onBack={() => {
            // This ensures we don't get back to "begin" step when abandoning the creation of new translation if we
            // already have some translation
            if (translationVersions.length > 0) {
              setMode('view')
            } else {
              setMode('add')
            }
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
            supplement={supplement}
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
            supplement={supplement}
            translationVersion={translationVersions.find(({ _data }) => _data.language === languageCode)!}
            onBack={() => setMode('view')}
            onSave={() => {
              setMode('view')
              // Invalidate language to force re-selection and reload of latest version
              setLanguageCode(null)
            }}
            onUnsavedWorkChange={onUnsavedWorkChange}
            advancedFeatures={advancedFeatures}
          />
        </div>
      )}
    </>
  )
}
