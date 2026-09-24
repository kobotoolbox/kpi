import './submissionDataList.scss'

import React from 'react'

import type { DataResponse } from '#/api/models/dataResponse'
import { getLanguageIndex } from '#/assetUtils'
import bem, { makeBem } from '#/bem'
import type { LanguageCode } from '#/components/languages/languagesStore'
import type { SubmissionDataListItem } from '#/components/submissions/submissionDataListUtils'
import { getSubmissionDataListItems } from '#/components/submissions/submissionDataListUtils'
import type { AssetResponse } from '#/dataInterface'

bem.SubmissionDataList = makeBem(null, 'submission-data-list', 'ul')
bem.SubmissionDataListQuestion = makeBem(null, 'submission-data-list-question', 'li')
bem.SubmissionDataListQuestion__path = makeBem(bem.SubmissionDataListQuestion, 'path')
bem.SubmissionDataListQuestion__label = makeBem(bem.SubmissionDataListQuestion, 'label', 'h3')
bem.SubmissionDataListQuestion__response = makeBem(bem.SubmissionDataListQuestion, 'response')

interface SubmissionDataListProps {
  asset: AssetResponse
  submission: DataResponse
  /** A list of questions that should be omitted from display. */
  hideQuestions?: string[]
  /** Whether to display the path (the groups) or not. */
  hideGroups?: boolean
  /** Language code or string to determine which labels to display (or XML values if set to XML_VALUES_OPTION_VALUE). */
  questionLabelLanguage?: LanguageCode | string
}

export default class SubmissionDataList extends React.Component<SubmissionDataListProps> {
  constructor(props: SubmissionDataListProps) {
    super(props)
    this.state = {}
  }

  renderQuestion(item: SubmissionDataListItem) {
    // check if the question should be hidden
    if (Array.isArray(this.props.hideQuestions) && this.props.hideQuestions.includes(item.name)) {
      return null
    }

    // A question that became a group in a later form version leaves an object behind, which
    // would render as `[object Object]`.
    const response = typeof item.data === 'string' || typeof item.data === 'number' ? item.data : null

    return (
      <bem.SubmissionDataListQuestion key={item.key}>
        {!this.props.hideGroups && item.parents.length >= 1 && (
          <bem.SubmissionDataListQuestion__path>{item.parents.join(' / ')}</bem.SubmissionDataListQuestion__path>
        )}

        <bem.SubmissionDataListQuestion__label>{item.label}</bem.SubmissionDataListQuestion__label>

        {/* `??`, not `||`: a response of `0` is a response. */}
        <bem.SubmissionDataListQuestion__response>{response ?? t('N/A')}</bem.SubmissionDataListQuestion__response>
      </bem.SubmissionDataListQuestion>
    )
  }

  render() {
    if (!this.props.asset.content || !this.props.asset.content.survey) {
      return null
    }

    const displayLanguage = this.props.questionLabelLanguage || ''
    const languageIndex = getLanguageIndex(this.props.asset, displayLanguage)

    const items = getSubmissionDataListItems(this.props.asset, languageIndex, this.props.submission)

    return <bem.SubmissionDataList dir='auto'>{items.map(this.renderQuestion.bind(this))}</bem.SubmissionDataList>
  }
}
