import React from 'react'
import Select from '#/components/common/Select'
import type { AssetResponse } from '#/dataInterface'

interface SubmissionLanguageSelectProps {
  asset: AssetResponse
  /** Index into the form's translations. */
  translationIndex: number
  onChange: (translationIndex: number) => void
}

/**
 * Picks which of the form's languages the record is displayed in. Renders
 * nothing unless there is more than one to choose from.
 */
export default function SubmissionLanguageSelect({ asset, translationIndex, onChange }: SubmissionLanguageSelectProps) {
  const translations = asset.content?.translations

  if (!asset.deployment__active || !translations || translations.length <= 1) {
    return null
  }

  // The index is the option value, because a language can be unnamed (i.e.
  // `null`), and `Select` needs a non-empty string value for every option.
  const options = translations.map((translation, index) => ({
    value: String(index),
    label: translation || t('Unnamed language'),
  }))

  return (
    <div className='submission-modal-dropdowns'>
      <Select
        label={t('Language')}
        size='xs'
        clearable={false}
        data={options}
        value={String(translationIndex)}
        onChange={(newValue) => {
          const index = Number(newValue)
          onChange(Number.isInteger(index) ? index : 0)
        }}
      />
    </div>
  )
}
