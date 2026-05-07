import React, { useState } from 'react'

import { Box, Group, TextInput } from '@mantine/core'
import ButtonNew from '#/components/common/ButtonNew'
import { toTitleCase } from '#/textUtils'
import type { LangObject } from '#/utils'
import { getLangAsObject } from '#/utils'

interface LanguageFormProps {
  /** Follows pattern "Name (code)", e.g. "English (en)" */
  langString?: string | null
  langIndex?: number
  onLanguageChange: (lang: LangObject, index: number) => void | Promise<void>
  /** Used for uniqueness validation */
  existingLanguages?: Array<string | null>
  isDefault?: boolean
  isPending?: boolean
}

function getInitialValues(langString?: string | null): { name: string; code: string } {
  if (langString) {
    const lang = getLangAsObject(langString)
    if (lang) {
      return { name: lang.name || '', code: lang.code || '' }
    }
    // Plain language name string without a code suffix
    return { name: langString, code: '' }
  }
  return { name: '', code: '' }
}

export default function LanguageForm(props: LanguageFormProps) {
  const initial = getInitialValues(props.langString)
  const [name, setName] = useState(initial.name)
  const [nameError, setNameError] = useState<string | null>(null)
  const [code, setCode] = useState(initial.code)
  const [codeError, setCodeError] = useState<string | null>(null)

  function isLanguageNameValid(): boolean {
    if (!props.existingLanguages) return true
    return !props.existingLanguages.some((langString) => {
      if (props.langString && langString === props.langString) return false
      if (langString === null) return false
      const langObj = getLangAsObject(langString)
      return langObj?.name === name
    })
  }

  function isLanguageCodeValid(): boolean {
    if (!props.existingLanguages) return true
    return !props.existingLanguages.some((langString) => {
      if (props.langString && langString === props.langString) return false
      if (langString === null) return false
      const langObj = getLangAsObject(langString)
      return langObj?.code === code
    })
  }

  function onSubmit(evt: React.FormEvent) {
    evt.preventDefault()

    const isNameValid = isLanguageNameValid()
    const isCodeValid = isLanguageCodeValid()

    setNameError(isNameValid ? null : t('Name must be unique!'))
    setCodeError(isCodeValid ? null : t('Code must be unique!'))

    if (isNameValid && isCodeValid) {
      let langIndex = props.isDefault ? 0 : -1
      if (props.langIndex !== undefined) {
        langIndex = props.langIndex
      }
      props.onLanguageChange({ name, code }, langIndex)
    }
  }

  const buttonLabel = props.langIndex !== undefined ? t('Update') : props.isDefault ? t('Set') : t('Add')

  return (
    <Box component='form' onSubmit={onSubmit}>
      <Group gap='sm'>
        <TextInput
          label={props.isDefault ? t('Default language name') : t('Language name')}
          value={name}
          onChange={(evt) => {
            setName(toTitleCase(evt.currentTarget.value.trim().toLowerCase()))
            setNameError(null)
          }}
          error={nameError}
        />

        <TextInput
          label={props.isDefault ? t('Default language code') : t('Language code')}
          value={code}
          onChange={(evt) => {
            setCode(evt.currentTarget.value.trim().toLowerCase())
            setCodeError(null)
          }}
          error={codeError}
        />

        <Box>
          <ButtonNew variant='filled' size='lg' type='submit' loading={props.isPending} disabled={!name || !code}>
            {buttonLabel}
          </ButtonNew>
        </Box>
      </Group>
    </Box>
  )
}
