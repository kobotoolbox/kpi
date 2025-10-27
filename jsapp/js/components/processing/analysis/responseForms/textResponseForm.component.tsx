import { Textarea } from '@mantine/core'
import React, { useContext, useState } from 'react'
import AnalysisQuestionsContext from '#/components/processing/analysis/analysisQuestions.context'
import { AUTO_SAVE_TYPING_DELAY } from '#/components/processing/analysis/constants'
import {
  findQuestion,
  getQuestionTypeDefinition,
  updateResponseAndReducer,
} from '#/components/processing/analysis/utils'
import commonStyles from './common.module.scss'
import CommonHeader from './commonHeader.component'

interface TextResponseFormProps {
  uuid: string
  canEdit: boolean
}

/**
 * Displays a common header and a string text box.
 */
export default function TextResponseForm(props: TextResponseFormProps) {
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
    <>
      <CommonHeader uuid={props.uuid}>

        <Textarea
          autosize
          minRows={2}
          value={response}
          onChange={(event) => onInputChange(event.currentTarget.value)}
          placeholder={t('Type your answer')}
          onBlur={saveResponse}
          disabled={!props.canEdit}
        />
      </CommonHeader>
    </>
  )
}
