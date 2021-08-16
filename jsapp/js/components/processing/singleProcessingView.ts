import React from 'react';
import {RouteComponentProps} from 'react-router';
import {actions} from 'js/actions';

type Props = RouteComponentProps<{
  uid: string,
  questionName: string,
  submissionId: string,
}, {}>;

export default class SingleProcessingView extends React.Component<Props, {}> {
  constructor(props: Props) {
    super(props);
  }
  
  componentDidMount() {
    actions.submissions.getSubmission.completed.listen(this.onGetSubmissionCompleted.bind(this))
    console.log(
      this.props.params.uid,
      this.props.params.questionName,
      this.props.params.submissionId
    );
  }
  
  onGetSubmissionCompleted(response): void {
    console.log('onGetSubmissionCompleted response', response);
  }
  
  render() {
    return 'single processing view';
  }
}
