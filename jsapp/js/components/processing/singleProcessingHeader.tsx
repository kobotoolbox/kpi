import React from 'react'
import bem, {makeBem} from 'js/bem'
import {AnyRowTypeName} from 'js/constants'
import {renderQuestionTypeIcon} from 'js/assetUtils'
import {ROUTES} from 'js/router/routerConstants'
import {hashHistory} from 'react-router'
import Button from 'js/components/common/button'
import './singleProcessingHeader.scss'

bem.SingleProcessingHeader = makeBem(null, 'single-processing-header', 'header')
bem.SingleProcessingHeader__column = makeBem(bem.SingleProcessingHeader, 'column', 'section')
bem.SingleProcessingHeader__submissions = makeBem(bem.SingleProcessingHeader, 'submissions', 'nav')
bem.SingleProcessingHeader__count = makeBem(bem.SingleProcessingHeader, 'count')
bem.SingleProcessingHeader__number = makeBem(bem.SingleProcessingHeader, 'number')
bem.SingleProcessingHeader__question = makeBem(bem.SingleProcessingHeader, 'question', 'h1')

type SingleProcessingHeaderProps = {
  questionType: AnyRowTypeName | undefined
  questionName: string
  questionLabel: string
  submissionId: string
  submissionsIds: (string | null)[]
  assetUid: string
}

type SingleProcessingHeaderState = {
  prevSubmissionId: string | null
  nextSubmissionId: string | null
}

/** Component with the question and UI for switching between submissions */
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

  /** Goes back to table view for given asset. */
  onDone() {
    const newRoute = ROUTES.FORM_TABLE.replace(':uid', this.props.assetUid)
    hashHistory.push(newRoute)
  }

  /** Goes to another submission */
  goToSubmission(targetSubmissionId: string) {
    const newRoute = ROUTES.FORM_PROCESSING
      .replace(':uid', this.props.assetUid)
      .replace(':questionName', this.props.questionName)
      .replace(':submissionId', targetSubmissionId)
    hashHistory.push(newRoute)
  }

  goPrev() {
    if (this.state.prevSubmissionId) {
      this.goToSubmission(this.state.prevSubmissionId)
    }
  }

  goNext() {
    if (this.state.nextSubmissionId) {
      this.goToSubmission(this.state.nextSubmissionId)
    }
  }

  /** Returns a natural number (first is 1, not 0) */
  getCurrentSubmissionNumber(): number {
    return this.props.submissionsIds.indexOf(this.props.submissionId) + 1
  }

  /**
   * Looks for closest previous submissionId that has data. It omits all `null`s
   * in submissionsIds array. Returns `null` if there is no such submissionId.
   */
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

    // finds the closest non-null submissionId going backwards from current one
    const leftSubmissionsIds = this.props.submissionsIds.slice(0, currentIndex)
    let foundId: string | null = null
    leftSubmissionsIds.forEach((id) => {
      if (id !== null) {
        foundId = id
      }
    })

    return foundId
  }

  /**
   * Looks for closest next submissionId that has data. It omits all `null`s
   * in submissionsIds array. Returns `null` if there is no such submissionId.
   */
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

    // finds the closest non-null submissionId going forwards from current one
    const rightSubmissionsIds = this.props.submissionsIds.slice(currentIndex + 1)
    let foundId: string | null = null
    rightSubmissionsIds.find((id) => {
      if (id !== null) {
        foundId = id
        return true
      }
      return false
    })

    return foundId
  }

  render() {
    return (
      <bem.SingleProcessingHeader>
        <bem.SingleProcessingHeader__column m='main'>
          <bem.SingleProcessingHeader__question>
            {this.props.questionType && renderQuestionTypeIcon(this.props.questionType)}
            {this.props.questionLabel}
          </bem.SingleProcessingHeader__question>
        </bem.SingleProcessingHeader__column>

        <bem.SingleProcessingHeader__column>
          <bem.SingleProcessingHeader__submissions>
            <Button
              type='bare'
              size='s'
              color='storm'
              startIcon='caret-left'
              onClick={this.goPrev.bind(this)}
              isDisabled={this.state.prevSubmissionId === null}
            />

            <bem.SingleProcessingHeader__count>
              <strong>
                {t('Submission')}
                &nbsp;
                {this.getCurrentSubmissionNumber()}
              </strong>
              &nbsp;
              {t('of ##total_count##').replace('##total_count##', String(this.props.submissionsIds.length))}
            </bem.SingleProcessingHeader__count>

            <Button
              type='bare'
              size='s'
              color='storm'
              endIcon='caret-right'
              onClick={this.goNext.bind(this)}
              isDisabled={this.state.nextSubmissionId === null}
            />
          </bem.SingleProcessingHeader__submissions>
        </bem.SingleProcessingHeader__column>

        <bem.SingleProcessingHeader__column>
          <Button
            type='frame'
            size='l'
            color='blue'
            label={t('DONE')}
            onClick={this.onDone.bind(this)}
          />
        </bem.SingleProcessingHeader__column>
      </bem.SingleProcessingHeader>
    )
  }
}
