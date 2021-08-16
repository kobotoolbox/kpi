import React from 'react';
import {RouteComponentProps} from 'react-router';

type ComposedProps = RouteComponentProps<{
  uid: string,
  questionName: string,
  submissionId: string,
}, {}>;

export default class SingleProcessingView extends React.Component<ComposedProps, {}> {
  componentDidMount() {
    console.log(
      this.props.params.uid,
      this.props.params.questionName,
      this.props.params.submissionId
    );
  }
  render() {
    return 'single processing view';
  }
}
