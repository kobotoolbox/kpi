import React, { useEffect, useState } from 'react'
import type { _DataSupplementResponseOneOfAutomaticGoogleTranslationVersionsItem } from '#/api/models/_dataSupplementResponseOneOfAutomaticGoogleTranslationVersionsItem'
import type { _DataSupplementResponseOneOfManualTranslationVersionsItem } from '#/api/models/_dataSupplementResponseOneOfManualTranslationVersionsItem'
import type { DataResponse } from '#/api/models/dataResponse'
import type { DataSupplementResponseOneOf } from '#/api/models/dataSupplementResponseOneOf'
import type {
  assetsAdvancedFeaturesListResponse,
  assetsDataSupplementRetrieveResponse,
} from '#/api/react-query/survey-data'
import type { LanguageCode } from '#/components/languages/languagesStore'
import type { AssetResponse } from '#/dataInterface'
import { recordKeys, recordValues } from '#/utils'
import bodyStyles from '../../common/processingBody.module.scss'
import { isSupplementVersionWithValue } from '../../common/utils'
import TranslationAdd from './TranslationAdd'
import Editor from './TranslationEdit/Editor'
import Viewer from './TranslationEdit/Viewer'

interface Props {
  asset: AssetResponse
  questionXpath: string
  submission: DataResponse & Record<string, string>
  onUnsavedWorkChange: (hasUnsavedWork: boolean) => void
  supplementData: assetsDataSupplementRetrieveResponse | undefined
  advancedFeaturesData: assetsAdvancedFeaturesListResponse | undefined
}

export default function TranscriptTab({
  asset,
  questionXpath,
  submission,
  onUnsavedWorkChange,
  supplementData,
  advancedFeaturesData,
}: Props) {
  const questionSupplement =
    supplementData?.status === 200 ? (supplementData.data[questionXpath] as DataSupplementResponseOneOf) : undefined

  // Backend said, that latest version is the "real version" and to discared the rest.
  // This should equal what can be found within `DataResponse._supplementalDetails`.
  const languages = [
    ...recordKeys(questionSupplement?.manual_translation ?? {}),
    ...recordKeys(questionSupplement?.automatic_google_translation ?? {}),
  ] as LanguageCode[]
  const translationVersions = recordValues(
    languages.reduce(
      (map, language) => {
        map[language] = [
          ...(questionSupplement?.manual_translation?.[language]?._versions || []),
          ...(questionSupplement?.automatic_google_translation?.[language]?._versions || []),
        ].sort((a, b) => (a._dateCreated < b._dateCreated ? 1 : -1))[0]
        return map
      },
      {} as Record<
        LanguageCode,
        | _DataSupplementResponseOneOfManualTranslationVersionsItem
        | _DataSupplementResponseOneOfAutomaticGoogleTranslationVersionsItem
      >,
    ),
  ).filter(isSupplementVersionWithValue)

  // Selected language Code to display.
  const [languageCode, setLanguageCode] = useState<LanguageCode | null>(null)
  const translationVersion = translationVersions.find(({ _data }) => _data.language === languageCode)

  useEffect(() => {
    if (translationVersion) return
    setLanguageCode(translationVersions[0]?._data.language ?? null)
  }, [translationVersion, setLanguageCode, translationVersions])

  console.log('TranslationTab', translationVersions)

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
    <div className={bodyStyles.root}>
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
          advancedFeaturesData={advancedFeaturesData}
        />
      )}
      {mode === 'view' && translationVersion && (
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
      )}
      {mode === 'edit' && translationVersion && (
        <Editor
          asset={asset}
          questionXpath={questionXpath}
          submission={submission}
          translationVersion={translationVersions.find(({ _data }) => _data.language === languageCode)!}
          onBack={() => setMode('view')}
          onSave={() => setMode('view')}
          onUnsavedWorkChange={onUnsavedWorkChange}
          advancedFeaturesData={advancedFeaturesData}
        />
      )}
    </div>
  )
}
