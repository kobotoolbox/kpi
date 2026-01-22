import { Textarea } from '@mantine/core'
import React, { useContext, useState } from 'react'
import type { DataResponse } from '#/api/models/dataResponse'
import type { AssetResponse } from '#/dataInterface'
import AnalysisQuestionsContext from '../../../common/analysisQuestions.context'
import { AUTO_SAVE_TYPING_DELAY } from '../../../common/constants'
import { findQuestion, getQuestionTypeDefinition, updateResponseAndReducer } from '../../../common/utils'
import ResponseForm from './ResponseForm'

interface Props {
  asset: AssetResponse
  submission: DataResponse & Record<string, string>
  uuid: string
  canEdit: boolean
}

/**
 * Displays a common header and a string text box.
 */
export default function TextResponseForm({ asset, submission, canEdit, uuid }: Props) {
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
  const [typingTimer, setTypingTimer] = useState<NodeJS.Timeout>()

  async function saveResponse() {
    clearTimeout(typingTimer)

    if (!analysisQuestions || !question) {
      return
    }

    updateResponseAndReducer(
      analysisQuestions.dispatch,
      question.xpath,
      uuid,
      question.type,
      response,
      asset.uid,
      submission['meta/rootUuid'],
    )
  }

  function saveResponseDelayedAndQuietly() {
    clearTimeout(typingTimer)
    // After 5 seconds we auto save
    setTypingTimer(setTimeout(saveResponse, AUTO_SAVE_TYPING_DELAY))
  }

  function onInputChange(newResponse: string) {
    analysisQuestions?.dispatch({ type: 'hasUnsavedWork' })
    setResponse(newResponse)
    saveResponseDelayedAndQuietly()
  }

  return (
    <ResponseForm asset={asset} uuid={uuid}>
      <Textarea
        autosize
        minRows={2}
        value={response}
        onChange={(event) => onInputChange(event.currentTarget.value)}
        placeholder={t('Type your answer')}
        onBlur={saveResponse}
        disabled={!canEdit}
      />
    </ResponseForm>
  )
}
