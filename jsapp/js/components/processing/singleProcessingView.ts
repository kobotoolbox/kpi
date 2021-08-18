import React from 'react';
import {RouteComponentProps} from 'react-router';
import {actions} from 'js/actions';

/**
 * this.props.params properties
 */
type Props = RouteComponentProps<{
  uid: string,
  questionName: string,
  submissionId: string,
}, {}>;

export default class SingleProcessingView extends React.Component<Props, {}> {
  constructor(props: Props) {
    super(props);
    this.state = {
      isReady: false,
      submissionData: null,
      error: null,
    }
  }
  
  componentDidMount() {
    actions.submissions.getSubmission.completed.listen(this.onGetSubmissionCompleted.bind(this))
    actions.submissions.getSubmission.failed.listen(this.onGetSubmissionFailed.bind(this))
    actions.submissions.getSubmission(this.props.params.uid, this.props.params.submissionId);
  }
  
  onGetSubmissionCompleted(response: SubmissionResponse): void {
    this.setState({
      isReady: true,
      submissionData: response,
    });
  }
  
  onGetSubmissionFailed(response: FailResponse): void {
    this.setState({
      isReady: true,
      error: response.responseJSON?.detail || t('Failed to get submission.'),
    });
  }
  
  render() {
    return 'single processing view';
  }
}
