import './submissionDataList.scss'

import React from 'react'

import { getFlatQuestionsList, getLanguageIndex } from '#/assetUtils'
import type { FlatQuestion } from '#/assetUtils'
import bem, { makeBem } from '#/bem'
import { getRowData } from '#/components/submissions/submissionUtils'
import type { AssetResponse, SubmissionResponse } from '#/dataInterface'
import singleProcessingStore from '../processing/singleProcessingStore'

bem.SubmissionDataList = makeBem(null, 'submission-data-list', 'ul')
bem.SubmissionDataListQuestion = makeBem(null, 'submission-data-list-question', 'li')
bem.SubmissionDataListQuestion__path = makeBem(bem.SubmissionDataListQuestion, 'path')
bem.SubmissionDataListQuestion__label = makeBem(bem.SubmissionDataListQuestion, 'label', 'h3')
bem.SubmissionDataListQuestion__response = makeBem(bem.SubmissionDataListQuestion, 'response')

interface SubmissionDataListProps {
  asset: AssetResponse
  submissionData: SubmissionResponse
  /** A list of questions that should be omitted from display. */
  hideQuestions?: string[]
  /** Whether to display the path (the groups) or not. */
  hideGroups?: boolean
}

export default class SubmissionDataList extends React.Component<SubmissionDataListProps> {
  constructor(props: SubmissionDataListProps) {
    super(props)
    this.state = {}
  }

  renderQuestion(question: FlatQuestion) {
    if (!this.props.asset || !this.props.asset.content) {
      return null
    }

    // check if the question shouldn't be hidden
    if (Array.isArray(this.props.hideQuestions) && this.props.hideQuestions.includes(question.name)) {
      return null
    }

    const response = getRowData(question.name, this.props.asset.content.survey || [], this.props.submissionData)

    return (
      <bem.SubmissionDataListQuestion key={question.name}>
        {!this.props.hideGroups && question.parents.length >= 1 && (
          <bem.SubmissionDataListQuestion__path>{question.parents.join(' / ')}</bem.SubmissionDataListQuestion__path>
        )}

        <bem.SubmissionDataListQuestion__label>{question.label}</bem.SubmissionDataListQuestion__label>

        <bem.SubmissionDataListQuestion__response>
          {response ? response : t('N/A')}
        </bem.SubmissionDataListQuestion__response>
      </bem.SubmissionDataListQuestion>
    )
  }

  render() {
    if (!this.props.asset.content || !this.props.asset.content.survey) {
      return null
    }

    const languageIndex = getLanguageIndex(this.props.asset, singleProcessingStore.getCurrentlyDisplayedLanguage())

    const items = getFlatQuestionsList(this.props.asset.content.survey, languageIndex)

    return <bem.SubmissionDataList dir='auto'>{items.map(this.renderQuestion.bind(this))}</bem.SubmissionDataList>
  }
}
