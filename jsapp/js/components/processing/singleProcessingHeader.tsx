import React from 'react';
import {bem, makeBem} from 'js/bem'
import {QuestionTypeName} from 'js/constants';
import './SingleProcessingHeader.scss';

bem.SingleProcessingHeader = makeBem(null, 'single-processing-header', 'header')
bem.SingleProcessingHeader__column = makeBem(bem.SingleProcessingHeader, 'column', 'section')
bem.SingleProcessingHeader__number = makeBem(bem.SingleProcessingHeader, 'number')

/**
 * this.props.params properties
 */
type SingleProcessingHeaderProps = {
  questionType: QuestionTypeName | undefined
  questionName: string
  submissionId: string
  submissionsIds: string[]
}

type SingleProcessingHeaderState = {
  prevSubmissionId: string | null
  nextSubmissionId: string | null
}

/**
 * This route component is being loaded with PermProtectedRoute so we know that
 * the call to backend to get asset was already made :happy_face:
 */
export default class SingleProcessingHeader extends React.Component<SingleProcessingHeaderProps, SingleProcessingHeaderState> {
  constructor(props: SingleProcessingHeaderProps) {
    super(props);
    this.state = {
      prevSubmissionId: this.getPrevSubmissionId(),
      nextSubmissionId: this.getNextSubmissionId(),
    }
  }

  onDone(evt: React.MouseEvent<HTMLButtonElement>) {
    console.log(evt)
  }

  /**
   * Returns the natural number (first is 1, not 0)
   */
  getCurrentSubmissionNumber(): number {
    return this.props.submissionsIds.indexOf(this.props.submissionId) + 1
  }

  getPrevSubmissionId(): string | null {
    const currentIndex = this.props.submissionsIds.indexOf(this.props.submissionId);
    // if not found current submissionId in the array, we don't know what is next
    if (currentIndex === -1) {
      return null;
    }
    // if on first element already, there is no previous
    if (currentIndex === 0) {
      return null;
    }
    return this.props.submissionsIds[currentIndex - 1] || null;
  }

  getNextSubmissionId(): string | null {
    const currentIndex = this.props.submissionsIds.indexOf(this.props.submissionId);
    // if not found current submissionId in the array, we don't know what is next
    if (currentIndex === -1) {
      return null;
    }
    // if on last element already, there is no next
    if (currentIndex === this.props.submissionsIds.length - 1) {
      return null;
    }
    return this.props.submissionsIds[currentIndex + 1] || null;
  }

  render() {
    return (
      <bem.SingleProcessingHeader>
        <bem.SingleProcessingHeader__column>
          icon in a colorful square: {this.props.questionType}
        </bem.SingleProcessingHeader__column>

        <bem.SingleProcessingHeader__column m='main'>
          {this.getCurrentSubmissionNumber()} of {this.props.submissionsIds.length}
          {t('Q: ##question_name##').replace('##question_name##', this.props.questionName)}
        </bem.SingleProcessingHeader__column>

        <bem.SingleProcessingHeader__column>
          <bem.KoboLightButton disabled={this.state.prevSubmissionId === null}>
            {t('< prev')}
          </bem.KoboLightButton>

          <bem.SingleProcessingHeader__number>
            {this.getCurrentSubmissionNumber()}
          </bem.SingleProcessingHeader__number>

          <bem.KoboLightButton disabled={this.state.nextSubmissionId === null}>
            {t('next >')}
          </bem.KoboLightButton>
        </bem.SingleProcessingHeader__column>

        <bem.SingleProcessingHeader__column>
          <bem.KoboLightButton m='blue' onClick={this.onDone.bind(this)}>
            {t('Done')}
          </bem.KoboLightButton>
        </bem.SingleProcessingHeader__column>
      </bem.SingleProcessingHeader>
    )
  }
}
