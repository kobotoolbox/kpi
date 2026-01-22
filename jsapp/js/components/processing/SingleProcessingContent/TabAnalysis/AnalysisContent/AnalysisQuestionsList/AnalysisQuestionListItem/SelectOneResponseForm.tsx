import { Radio, Stack } from '@mantine/core'
import React, { useContext, useState } from 'react'
import type { DataResponse } from '#/api/models/dataResponse'
import type { RadioOption } from '#/components/common/radio'
import type { AssetResponse } from '#/dataInterface'
import AnalysisQuestionsContext from '../../../common/analysisQuestions.context'
import { findQuestion, getQuestionTypeDefinition, updateResponseAndReducer } from '../../../common/utils'
import ResponseForm from './ResponseForm'

interface Props {
  asset: AssetResponse
  submission: DataResponse & Record<string, string>
  uuid: string
  canEdit: boolean
}

/**
 * Displays a common header and radio input with all available choices.
 */
export default function SelectOneResponseForm({ asset, submission, canEdit: _canEdit, uuid }: Props) {
  const analysisQuestions = useContext(AnalysisQuestionsContext)
  if (!analysisQuestions) {
    return null
  }

  // Get the question data from state (with safety check)
  const question = findQuestion(uuid, analysisQuestions.state)
  if (!question) {
    return null
  }

  // Get the question definition (with safety check)
  const qaDefinition = getQuestionTypeDefinition(question.type)
  if (!qaDefinition) {
    return null
  }

  // This will either be an existing response or an empty string
  const initialResponse = typeof question.response === 'string' ? question.response : ''

  const [response, setResponse] = useState<string>(initialResponse)

  function onRadioChange(newResponse: string) {
    if (!analysisQuestions || !question) {
      return
    }

    // Update local state
    setResponse(newResponse)

    // Update endpoint and reducer
    updateResponseAndReducer(
      analysisQuestions.dispatch,
      question.xpath,
      uuid,
      question.type,
      newResponse,
      asset.uid,
      submission['meta/rootUuid'],
    )
  }

  function getOptions(): RadioOption[] {
    if (question?.additionalFields?.choices) {
      return (
        question?.additionalFields?.choices
          // We hide all choices flagged as deleted…
          .filter((item) => !item.options?.deleted)
          // …and then we produce radio option object of each choice left
          .map((choice) => {
            return {
              value: choice.uuid,
              label: choice.labels._default,
            }
          })
      )
    }
    return []
  }

  return (
    <ResponseForm asset={asset} uuid={uuid} onClear={() => setResponse('')}>
      <Radio.Group>
        <Stack gap={'xs'}>
          {getOptions().map((option) => (
            <Radio
              value={option.value}
              label={option.label}
              onChange={(newResponse) => onRadioChange(newResponse.currentTarget.value)}
              checked={response === option.value}
            />
          ))}
        </Stack>
      </Radio.Group>
    </ResponseForm>
  )
}
