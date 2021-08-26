import React from 'react';
import bem from 'js/bem';
import {QuestionTypeName} from 'js/constants';

bem.SingleProcessingHeader = bem.create('single-processing-header', 'header');

/**
 * this.props.params properties
 */
type SingleProcessingHeaderProps = {
  questionType: QuestionTypeName | undefined
  questionName: string | null
  submissionId: string
  totalSubmissions: number
}

/**
 * This route component is being loaded with PermProtectedRoute so we know that
 * the call to backend to get asset was already made :happy_face:
 */
export default class SingleProcessing extends React.Component<SingleProcessingHeaderProps, {}> {
  constructor(props: SingleProcessingHeaderProps) {
    super(props);
  }

  render() {
    return (
      <bem.SingleProcessingHeader>
        <span>{this.props.questionType}</span>
        <span>{this.props.questionName}</span>
        <span>{this.props.submissionId}</span>
        <span>{this.props.totalSubmissions}</span>
      </bem.SingleProcessingHeader>
    )
  }
}
