import React, { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import type { AdvancedFeatureResponse } from '#/api/models/advancedFeatureResponse'
import type { BulkActionResponse } from '#/api/models/bulkActionResponse'
import type { DataResponse } from '#/api/models/dataResponse'
import type { DataSupplementResponse } from '#/api/models/dataSupplementResponse'
import type { LanguageCode } from '#/components/languages/languagesStore'
import { ProcessingTab, goToProcessing } from '#/components/processing/routes.utils'
import type { AssetResponse } from '#/dataInterface'
import { removeDefaultUuidPrefix } from '#/utils'
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
  activeBulkActions: BulkActionResponse[]
  onUnsavedWorkChange: (hasUnsavedWork: boolean) => void
  supplement: DataSupplementResponse
  advancedFeatures: AdvancedFeatureResponse[]
}

export default function TranslationTab({
  asset,
  questionXpath,
  submission,
  activeBulkActions,
  onUnsavedWorkChange,
  supplement,
  advancedFeatures,
}: Props) {
  const translationVersions = useMemo(
    () => getAllTranslationsFromSupplementData(supplement, questionXpath, false),
    [supplement, questionXpath],
  )

  // Read languageCode from URL params if available (for direct navigation to specific translation)
  const params = useParams<{ languageCode?: string }>()
  const urlLanguageCode = params.languageCode as LanguageCode | undefined

  // Selected language code to display.
  const [languageCode, setLanguageCode] = useState<LanguageCode | null>(null)
  const translationVersion = translationVersions.find(({ _data }) => _data.language === languageCode)

  useEffect(() => {
    if (translationVersion) return

    // First priority: use languageCode from URL if available and valid
    if (urlLanguageCode) {
      const urlTranslation = translationVersions.find(({ _data }) => _data.language === urlLanguageCode)
      if (urlTranslation) {
        setLanguageCode(urlLanguageCode)
        return
      }
    }

    // Second priority: get latest translation if current selected is not available
    const latestTranslation = getLatestAutomaticTranslationVersionItem(supplement, questionXpath, undefined, false)
    if (!latestTranslation) {
      setLanguageCode(null)
      return
    }
    const fallbackLanguage = latestTranslation._data.language
    setLanguageCode(fallbackLanguage)

    // If URL had a language code that doesn't exist in this submission, update URL to match the fallback
    if (urlLanguageCode && fallbackLanguage) {
      const submissionEditId = removeDefaultUuidPrefix(submission['meta/rootUuid']) || submission._uuid
      goToProcessing(asset.uid, questionXpath, submissionEditId, ProcessingTab.Translations, fallbackLanguage)
    }
  }, [
    translationVersion,
    setLanguageCode,
    supplement,
    questionXpath,
    urlLanguageCode,
    translationVersions,
    asset.uid,
    submission,
  ])

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

  // The useEffect roundabout way of setting currently selected `languageCode` and thus `translationVersion` will
  // produce a flicker of begin button in case there are translations.
  // Workaround: don't show anything for the first render, nothing is better than a flicker of the wrong thing.
  // TODO: untangle and simplify the state management for the mode.
  if (translationVersions.length > 0 && !languageCode) return

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
          activeBulkActions={activeBulkActions}
          onCreate={(newLanguageCode: LanguageCode, context: 'automated' | 'manual') => {
            // After creating automated translation, go straight into 'edit' mode
            if (context === 'automated') {
              setMode('edit')
            } else {
              setMode('view')
            }
            setLanguageCode(newLanguageCode)
            // Update URL to reflect the newly created translation language
            const submissionEditId = removeDefaultUuidPrefix(submission['meta/rootUuid']) || submission._uuid
            goToProcessing(asset.uid, questionXpath, submissionEditId, ProcessingTab.Translations, newLanguageCode)
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
            activeBulkActions={activeBulkActions}
            onEdit={() => setMode('edit')}
            onAdd={() => setMode('add')}
            onChangeLanguageCode={(newLanguageCode: LanguageCode) => {
              // Update browser URL to reflect the new language selection
              const submissionEditId = removeDefaultUuidPrefix(submission['meta/rootUuid']) || submission._uuid
              goToProcessing(asset.uid, questionXpath, submissionEditId, ProcessingTab.Translations, newLanguageCode)
              // Update local state (navigation will cause re-render, but this provides immediate feedback)
              setLanguageCode(newLanguageCode)
            }}
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
