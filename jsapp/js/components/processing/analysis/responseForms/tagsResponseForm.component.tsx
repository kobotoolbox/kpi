import React, { useContext, useState } from 'react'

import { TagsInput } from '@mantine/core'
// We don't use `KoboTagsInput` here, because we don't want the tags splitting
// feature it has built in. It's easier for us to use `TagsInput` directly.
import AnalysisQuestionsContext from '#/components/processing/analysis/analysisQuestions.context'
import {
  findQuestion,
  getQuestionTypeDefinition,
  updateResponseAndReducer,
} from '#/components/processing/analysis/utils'
import commonStyles from './common.module.scss'
import CommonHeader from './commonHeader.component'

interface TagsResponseFormProps {
  uuid: string
  canEdit: boolean
}

/**
 * Displays a common header and a tags input.
 */
export default function TagsResponseForm(props: TagsResponseFormProps) {
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

  // This will either be an existing list of tags, or an empty list.
  const initialResponse = Array.isArray(question.response) ? question.response : []

  const [response, setResponse] = useState<string[]>(initialResponse)

  function onTagsChange(newTags: string[]) {
    if (!analysisQuestions || !question) {
      return
    }

    // Update local state
    setResponse(newTags)

    // Update endpoint and reducer
    updateResponseAndReducer(analysisQuestions.dispatch, question.xpath, props.uuid, question.type, newTags)
  }

  return (
    <>
      <CommonHeader uuid={props.uuid}>
        <TagsInput value={response} onChange={onTagsChange} acceptValueOnBlur disabled={!props.canEdit} />
      </CommonHeader>
    </>
  )
}
