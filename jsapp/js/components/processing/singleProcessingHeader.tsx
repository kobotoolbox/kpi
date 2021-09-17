import React from 'react'
import bem, {makeBem} from 'js/bem'
import {AnyRowTypeName} from 'js/constants'
import {renderQuestionTypeIcon} from 'js/assetUtils'
import {ROUTES} from 'js/router/routerConstants'
import {hashHistory} from 'react-router'
import './singleProcessingHeader.scss'

bem.SingleProcessingHeader = makeBem(null, 'single-processing-header', 'header')
bem.SingleProcessingHeader__column = makeBem(bem.SingleProcessingHeader, 'column', 'section')
bem.SingleProcessingHeader__number = makeBem(bem.SingleProcessingHeader, 'number')
bem.SingleProcessingHeader__typeIcon = makeBem(bem.SingleProcessingHeader, 'type-icon')
bem.SingleProcessingHeader__count = makeBem(bem.SingleProcessingHeader, 'count')
bem.SingleProcessingHeader__question = makeBem(bem.SingleProcessingHeader, 'question', 'h1')
bem.SingleProcessingHeader__button = makeBem(bem.SingleProcessingHeader, 'button', 'button')

type SingleProcessingHeaderProps = {
  questionType: AnyRowTypeName | undefined
  questionName: string
  questionLabel: string
  submissionId: string
  submissionsIds: string[]
  assetUid: string
}

type SingleProcessingHeaderState = {
  prevSubmissionId: string | null
  nextSubmissionId: string | null
}

export default class SingleProcessingHeader extends React.Component<
  SingleProcessingHeaderProps,
  SingleProcessingHeaderState
> {
  constructor(props: SingleProcessingHeaderProps) {
    super(props)
    this.state = {
      prevSubmissionId: this.getPrevSubmissionId(),
      nextSubmissionId: this.getNextSubmissionId(),
    }
  }

  /**
   * Goes back to table view for given asset.
   */
  onDone() {
    const newRoute = ROUTES.FORM_TABLE.replace(':uid', this.props.assetUid)
    hashHistory.push(newRoute)
  }

  /**
   * Goes to another submission (relatively to current one)
   */
  goToSubmission(indexChange: number) {
    const currentIndex = this.props.submissionsIds.indexOf(this.props.submissionId)
    const newSubmissionId = this.props.submissionsIds[currentIndex + indexChange]
    const newRoute = ROUTES.FORM_PROCESSING
      .replace(':uid', this.props.assetUid)
      .replace(':questionName', this.props.questionName)
      .replace(':submissionId', newSubmissionId)
    hashHistory.push(newRoute)
  }

  goPrev() {
    this.goToSubmission(-1)
  }

  goNext() {
    this.goToSubmission(1)
  }

  /**
   * Returns the natural number (first is 1, not 0)
   */
  getCurrentSubmissionNumber(): number {
    return this.props.submissionsIds.indexOf(this.props.submissionId) + 1
  }

  getPrevSubmissionId(): string | null {
    const currentIndex = this.props.submissionsIds.indexOf(this.props.submissionId)
    // if not found current submissionId in the array, we don't know what is next
    if (currentIndex === -1) {
      return null
    }
    // if on first element already, there is no previous
    if (currentIndex === 0) {
      return null
    }
    return this.props.submissionsIds[currentIndex - 1] || null
  }

  getNextSubmissionId(): string | null {
    const currentIndex = this.props.submissionsIds.indexOf(this.props.submissionId)
    // if not found current submissionId in the array, we don't know what is next
    if (currentIndex === -1) {
      return null
    }
    // if on last element already, there is no next
    if (currentIndex === this.props.submissionsIds.length - 1) {
      return null
    }
    return this.props.submissionsIds[currentIndex + 1] || null
  }

  render() {
    return (
      <bem.SingleProcessingHeader>
        <bem.SingleProcessingHeader__column m='icon'>
          <bem.SingleProcessingHeader__typeIcon>
            {this.props.questionType && renderQuestionTypeIcon(this.props.questionType)}
          </bem.SingleProcessingHeader__typeIcon>
        </bem.SingleProcessingHeader__column>

        <bem.SingleProcessingHeader__column m='main'>
          <bem.SingleProcessingHeader__count>
            <strong>{this.getCurrentSubmissionNumber()}</strong>
            &nbsp;
            {t('of ##total_count##').replace('##total_count##', String(this.props.submissionsIds.length))}
          </bem.SingleProcessingHeader__count>

          <bem.SingleProcessingHeader__question>
            {t('Q: ##question_label##').replace('##question_label##', this.props.questionLabel)}
          </bem.SingleProcessingHeader__question>
        </bem.SingleProcessingHeader__column>

        <bem.SingleProcessingHeader__column m='navigation'>
          <bem.SingleProcessingHeader__button
            m='prev'
            onClick={this.goPrev.bind(this)}
            disabled={this.state.prevSubmissionId === null}
          >
            <i className='k-icon k-icon-caret-left'/>
            {t('prev')}
          </bem.SingleProcessingHeader__button>

          <bem.SingleProcessingHeader__number>
            {this.getCurrentSubmissionNumber()}
          </bem.SingleProcessingHeader__number>

          <bem.SingleProcessingHeader__button
            m='next'
            onClick={this.goNext.bind(this)}
            disabled={this.state.nextSubmissionId === null}
          >
            {t('next')}
            <i className='k-icon k-icon-caret-right'/>
          </bem.SingleProcessingHeader__button>

          <bem.SingleProcessingHeader__button
            m='done'
            onClick={this.onDone.bind(this)}
          >
            {t('Done')}
          </bem.SingleProcessingHeader__button>
        </bem.SingleProcessingHeader__column>
      </bem.SingleProcessingHeader>
    )
  }
}
