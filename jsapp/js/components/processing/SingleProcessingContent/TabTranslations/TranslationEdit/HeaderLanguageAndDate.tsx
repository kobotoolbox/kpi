import React from 'react'
import type { DataSupplementResponse } from '#/api/models/dataSupplementResponse'
import type { LanguageCode } from '#/components/languages/languagesStore'
import { AsyncLanguageDisplayLabel } from '#/components/languages/languagesUtils'
import type { TranslationVersionItem } from '#/components/processing/common/types'
import { TransxVersionSortFunction, isSupplementVersionWithValue } from '#/components/processing/common/utils'
import bodyStyles from '../../../common/processingBody.module.scss'
import TransxSelector from '../../../components/transxSelector'
import TransxDate from '../../components/transxDate'

interface Props {
  supplement: DataSupplementResponse
  xpath: string
  translationVersion: TranslationVersionItem
  translationVersions?: TranslationVersionItem[]
  onChangeLanguageCode?: (languageCode: LanguageCode) => void
}

export default function HeaderLanguageAndDate({
  supplement,
  xpath,
  translationVersion,
  translationVersions,
  onChangeLanguageCode,
}: Props) {
  const existingTranslations = translationVersions
    ?.filter(isSupplementVersionWithValue)
    .sort(TransxVersionSortFunction)
    .reverse()

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
      <TransxDate transxVersion={translationVersion} supplement={supplement} xpath={xpath} />
    </React.Fragment>
  )
}
