import React, { useState, useCallback } from 'react'

import { Stack, ThemeIcon } from '@mantine/core'
import clonedeep from 'lodash.clonedeep'
import type { ResponseQualActionParams } from '#/api/models/responseQualActionParams'
import type { ResponseQualSelectQuestionParamsChoicesItem } from '#/api/models/responseQualSelectQuestionParamsChoicesItem'
import Button from '#/components/common/button'
import Icon from '#/components/common/icon'
import TextBox from '#/components/common/textBox'
import { generateUuid } from '#/utils'
import { type AdvancedFeatureResponseManualQual, getQuestionTypeDefinition } from '../../../../common/utils'
import KeywordSearchFieldsEditor from './KeywordSearchFieldsEditor'
import SelectXFieldsEditor from './SelectXFieldsEditor'
import styles from './index.module.scss'

interface Props {
  advancedFeature: AdvancedFeatureResponseManualQual
  qaQuestion: ResponseQualActionParams
  disabled: boolean
  onSaveQuestion: (params: ResponseQualActionParams[]) => Promise<unknown>
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

  const [newQaQuestion, setNewQaQuestion] = useState<ResponseQualActionParams>(() => clonedeep(qaQuestion))

  const [errorMessageLabel, setErrorMessageLabel] = useState<string | undefined>()
  const [errorMessageChoices, setErrorMessageChoices] = useState<string | undefined>()

  const handleChangeLabel = useCallback((newLabel: string) => {
    setNewQaQuestion(() => ({
      ...clonedeep(newQaQuestion),
      labels: {
        _default: newLabel, // TODO: what about other non-default labels?
      },
    }))
    if (newLabel !== '') setErrorMessageLabel(() => undefined)
  }, [])

  function handleChangeChoices(choices: ResponseQualSelectQuestionParamsChoicesItem[]) {
    console.log(newQaQuestion, choices)
    setNewQaQuestion(() => ({
      ...clonedeep(newQaQuestion),
      choices,
    }))
    // TODO: duplicate validation to determine whenever to keep or remove the error msg.
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
        setErrorMessageChoices(t('Some required fields are missing')) // TODO: better error messages?
        hasErrors = true
      }
    }

    if (hasErrors) return

    const payload = clonedeep(newQaQuestion)
    if (payload.uuid === 'placeholder') payload.uuid = generateUuid()

    const questionIndex = advancedFeature.params.findIndex((qaQuestion) => qaQuestion.uuid === newQaQuestion.uuid)

    let newParams: ResponseQualActionParams[]

    if (questionIndex === -1) {
      // Question doesn't exist yet (new question), add it to the end
      newParams = [...advancedFeature.params, payload]
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

      {'choices' in newQaQuestion && (
        // Hard coded left padding to account for the 32px icon size + 8px gap
        // 0px gap because the children still did not get a mantine refactor so we must respect existing styles
        <Stack pl={'40px'} gap={'0px'}>
          {(newQaQuestion.type as any) === 'qual_auto_keyword_count' && ( // TODO OpenAPI: DEV-1628
            <KeywordSearchFieldsEditor
              questionUuid={newQaQuestion.uuid}
              fields={{ source: '', keywords: [] }} // TODO
              onFieldsChange={() => null} // TODO
            />
          )}

          {(newQaQuestion.type === 'qualSelectOne' || newQaQuestion.type === 'qualSelectMultiple') && (
            <SelectXFieldsEditor qaQuestion={newQaQuestion} onChange={handleChangeChoices} disabled={disabled} />
          )}

          {errorMessageChoices && <p>{errorMessageChoices}</p>}
        </Stack>
      )}
    </>
  )
}

const a = {
  params: [
    { type: 'qualText', uuid: 'c3b0dab6-a689-4fdd-9cb6-e742e7931c15', labels: { _default: 'second' } },
    { type: 'qualText', uuid: 'placeholder', labels: { _default: 'asdf' }, options: { deleted: true } },
  ],
  question_xpath: 'Use_the_camera_s_mic_ne_to_record_a_sound',
  action: 'manual_qual',
  asset: 25,
  uid: 'qafqnZC5DMN8eGWLB4cR4T2h',
}
