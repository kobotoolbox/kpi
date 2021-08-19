import React from 'react';
import {RouteComponentProps} from 'react-router';
import {actions} from 'js/actions';
import bem from 'js/bem';
import LoadingSpinner from 'js/components/common/loadingSpinner';

bem.SingleProcessingView = bem.create('single-processing-view', 'section');
bem.SingleProcessingView__header = bem.SingleProcessingView.__('header', 'header');

/**
 * this.props.params properties
 */
type SingleProcessingViewProps = RouteComponentProps<{
  uid: string,
  questionName: string,
  submissionId: string,
}, {}>;

type SingleProcessingViewState = {
  isReady: boolean
  submissionData: SubmissionResponse | null
  error: string | null
}

export default class SingleProcessingView extends React.Component<SingleProcessingViewProps, SingleProcessingViewState> {
  constructor(props: SingleProcessingViewProps) {
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
    if (!this.state.isReady) {
      return <LoadingSpinner/>;
    }
    return 'single processing view';
  }
}
