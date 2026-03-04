import React, { useState, useCallback } from 'react'

import { Stack, ThemeIcon } from '@mantine/core'
import clonedeep from 'lodash.clonedeep'
import type { ResponseManualQualActionParams } from '#/api/models/responseManualQualActionParams'
import type { ResponseQualSelectQuestionParamsChoicesItem } from '#/api/models/responseQualSelectQuestionParamsChoicesItem'
import Button from '#/components/common/button'
import Icon from '#/components/common/icon'
import TextBox from '#/components/common/textBox'
import { LOCALLY_EDITED_PLACEHOLDER_UUID } from '#/components/processing/common/constants'
import { generateUuid } from '#/utils'
import { type AdvancedFeatureResponseManualQual, getQuestionTypeDefinition } from '../../../../common/utils'
import KeywordSearchFieldsEditor from './KeywordSearchFieldsEditor'
import SelectXFieldsEditor from './SelectXFieldsEditor'
import styles from './index.module.scss'

interface Props {
  advancedFeature: AdvancedFeatureResponseManualQual
  qaQuestion: ResponseManualQualActionParams
  disabled: boolean
  onSaveQuestion: (params: ResponseManualQualActionParams[]) => Promise<unknown>
  onCancel: () => unknown
}

/**
 * Displays a form for editing question definition. All the question types share
 * the code for updating the question label. Some question types also can define
 * custom additional fields. For these we load additional forms.
 */
export default function AnalysisQuestionEditor({
  advancedFeature,
  qaQuestion,
  onSaveQuestion,
  onCancel,
  disabled,
}: Props) {
  // Get the question definition (with safety check)
  const qaQuestionDef = getQuestionTypeDefinition(qaQuestion.type)
  if (!qaQuestionDef) {
    return null
  }

  const [newQaQuestion, setNewQaQuestion] = useState<ResponseManualQualActionParams>(() => clonedeep(qaQuestion))

  const [errorMessageLabel, setErrorMessageLabel] = useState<string | undefined>()
  const [errorMessageChoices, setErrorMessageChoices] = useState<string | undefined>()

  const handleChangeLabel = useCallback((newLabel: string) => {
    setNewQaQuestion(() => ({
      ...clonedeep(newQaQuestion),
      labels: {
        _default: newLabel,
      },
    }))
    if (newLabel !== '') setErrorMessageLabel(() => undefined)
  }, [])

  function handleChangeChoices(choices: ResponseQualSelectQuestionParamsChoicesItem[]) {
    setNewQaQuestion(() => ({
      ...clonedeep(newQaQuestion),
      choices,
    }))
    const choicesFiltered = choices.filter((choice) => !choice.options?.deleted)
    if (choicesFiltered.length > 0 && choicesFiltered.every((choice) => choice.labels._default !== '')) {
      setErrorMessageChoices(() => undefined)
    }
  }

  const handleSubmit = async (evt: React.FormEvent<HTMLFormElement>) => {
    evt.preventDefault()
    let hasErrors = false

    // Check missing label
    if (newQaQuestion.labels._default === '') {
      setErrorMessageLabel(t('Question label cannot be empty'))
      hasErrors = true
    }

    // Check missing additional fields and their labels
    if ('choices' in newQaQuestion) {
      const choices = newQaQuestion.choices.filter((choice) => !choice.options?.deleted)
      if (choices.length === 0) {
        setErrorMessageChoices(t('Some required fields are missing'))
        hasErrors = true
      }
      if (choices.some((choice) => choice.labels._default === '')) {
        setErrorMessageChoices(t('Some required fields are missing'))
        hasErrors = true
      }
    }

    if (hasErrors) return

    const payload = clonedeep(newQaQuestion)
    if (payload.uuid === LOCALLY_EDITED_PLACEHOLDER_UUID) payload.uuid = generateUuid()

    const questionIndex = advancedFeature.params.findIndex((qaQuestion) => qaQuestion.uuid === newQaQuestion.uuid)

    let newParams: ResponseManualQualActionParams[]

    if (questionIndex === -1) {
      // Question doesn't exist yet (new question), add it at the top
      newParams = [payload, ...advancedFeature.params]
    } else {
      // Question exists (editing), replace it at its index
      newParams = [
        ...advancedFeature.params.slice(0, questionIndex),
        payload,
        ...advancedFeature.params.slice(questionIndex + 1),
      ]
    }

    await onSaveQuestion(newParams)
  }

  function handleCancel() {
    setNewQaQuestion(clonedeep(qaQuestion))
    onCancel()
  }

  return (
    // TODO: mantineify the rest of this component, it's partially complete to remove dependency on deprecated styles
    // DEV-1237
    <>
      <header className={styles.header}>
        <form className={styles.headerForm} onSubmit={handleSubmit}>
          <ThemeIcon ta={'center'} variant='light-teal'>
            <Icon name={qaQuestionDef.icon} size='xl' />
          </ThemeIcon>

          <TextBox
            value={newQaQuestion.labels._default}
            onChange={handleChangeLabel}
            errors={errorMessageLabel}
            placeholder={t('Type question')}
            className={styles.labelInput}
            renderFocused
            size='m'
          />

          <Button type='primary' size='m' label={t('Save')} isPending={disabled} isSubmit />

          <Button type='secondary' size='m' label={t('Cancel')} onClick={handleCancel} isDisabled={disabled} />
        </form>
      </header>

      {newQaQuestion.type === 'qualAutoKeywordCount' && (
        <KeywordSearchFieldsEditor
          questionUuid={newQaQuestion.uuid}
          fields={{ source: '', keywords: [] }} // TODO
          onFieldsChange={() => null} // TODO
        />
      )}

      {'choices' in newQaQuestion && (
        // Hard coded left padding to account for the 32px icon size + 8px gap
        // 0px gap because the children still did not get a mantine refactor so we must respect existing styles
        <Stack pl={'40px'} gap={'0px'}>
          {(newQaQuestion.type === 'qualSelectOne' || newQaQuestion.type === 'qualSelectMultiple') && (
            <SelectXFieldsEditor qaQuestion={newQaQuestion} onChange={handleChangeChoices} disabled={disabled} />
          )}

          {errorMessageChoices && <p>{errorMessageChoices}</p>}
        </Stack>
      )}
    </>
  )
}
