import React from 'react'

import type { _DataSupplementResponseOneOfAutomaticGoogleTranscriptionVersionsItem } from '#/api/models/_dataSupplementResponseOneOfAutomaticGoogleTranscriptionVersionsItem'
import type { _DataSupplementResponseOneOfManualTranscriptionVersionsItem } from '#/api/models/_dataSupplementResponseOneOfManualTranscriptionVersionsItem'
import type { LanguageCode } from '#/components/languages/languagesStore'
import { AsyncLanguageDisplayLabel } from '#/components/languages/languagesUtils'
import { isSupplementVersionWithValue } from '#/components/processing/common/utils'
import bodyStyles from '../../../common/processingBody.module.scss'
import TransxSelector from '../../../components/transxSelector'
import TransxDate from '../../components/transxDate'

interface Props {
  translationVersion:
    | _DataSupplementResponseOneOfManualTranscriptionVersionsItem
    | _DataSupplementResponseOneOfAutomaticGoogleTranscriptionVersionsItem
  translationVersions?: Array<
    | _DataSupplementResponseOneOfManualTranscriptionVersionsItem
    | _DataSupplementResponseOneOfAutomaticGoogleTranscriptionVersionsItem
  >
  onChangeLanguageCode?: (languageCode: LanguageCode) => void
}

export default function HeaderLanguageAndDate({
  translationVersion,
  translationVersions,
  onChangeLanguageCode,
}: Props) {
  const existingTranslations = translationVersions?.filter(isSupplementVersionWithValue)

  console.log('xxx translationVersion', translationVersion)

  return (
    <React.Fragment>
      {existingTranslations && onChangeLanguageCode ? (
        <label className={bodyStyles.transxHeaderLanguage}>
          <TransxSelector
            languageCodes={existingTranslations.map(({ _data }) => _data.language)}
            selectedLanguage={translationVersion._data.language}
            onChange={(newSelectedOption: LanguageCode | null) => {
              newSelectedOption && onChangeLanguageCode(newSelectedOption)
            }}
            size='s'
            type='blue'
          />
        </label>
      ) : (
        <label className={bodyStyles.transxHeaderLanguage}>
          <AsyncLanguageDisplayLabel code={translationVersion._data.language} />
        </label>
      )}
      {/* TODO OpenAPI: add _dateModified */}
      {translationVersion._dateCreated !== '' && <TransxDate dateCreated={translationVersion._dateCreated} />}
    </React.Fragment>
  )
}
