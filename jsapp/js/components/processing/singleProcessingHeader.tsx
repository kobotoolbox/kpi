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
  submissionsIds: string[]
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
        <div>type: {this.props.questionType}</div>
        <div>name: {this.props.questionName}</div>
        <div>id: {this.props.submissionId}</div>
        <div>{this.props.submissionsIds.indexOf(this.props.submissionId) + 1} of {this.props.submissionsIds.length}</div>
      </bem.SingleProcessingHeader>
    )
  }
}
