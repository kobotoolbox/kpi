import { NumberInput } from '@mantine/core'
import React, { useContext, useState } from 'react'
import AnalysisQuestionsContext from '../../../common/analysisQuestions.context'
import { AUTO_SAVE_TYPING_DELAY } from '../../../common/constants'
import { findQuestion, getQuestionTypeDefinition, updateResponseAndReducer } from '../../../common/utils'
import ResponseForm from './ResponseForm'

interface IntegerResponseFormProps {
  uuid: string
  canEdit: boolean
}

/**
 * Displays a common header and an integer text box.
 */
export default function IntegerResponseForm(props: IntegerResponseFormProps) {
  const analysisQuestions = useContext(AnalysisQuestionsContext)
  if (!analysisQuestions) {
    return null
  }

  // Get the question data from state (with safety check)
  const question = findQuestion(props.uuid, analysisQuestions.state)
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

    updateResponseAndReducer(analysisQuestions.dispatch, question.xpath, props.uuid, question.type, response)
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
    <ResponseForm uuid={props.uuid}>
      <NumberInput
        value={response}
        onChange={(newResponse) => onInputChange(newResponse.toString())}
        placeholder={t('Type your answer')}
        onBlur={saveResponse}
        disabled={!props.canEdit}
      />
    </ResponseForm>
  )
}
