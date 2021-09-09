import React from 'react';
import bem, {makeBem} from 'js/bem';
import './singleProcessingSubmissionDetails.scss';

bem.SingleProcessingSubmissionDetails = makeBem(null, 'single-processing-submission-details', 'section')

/**
 * this.props.params properties
 */
type SingleProcessingSubmissionDetailsProps = {
  submissionData: SubmissionResponse
}

type SingleProcessingSubmissionDetailsState = {}

/**
 * This route component is being loaded with PermProtectedRoute so we know that
 * the call to backend to get asset was already made :happy_face:
 */
export default class SingleProcessingSubmissionDetails extends React.Component<
  SingleProcessingSubmissionDetailsProps,
  SingleProcessingSubmissionDetailsState
> {
  constructor(props: SingleProcessingSubmissionDetailsProps) {
    super(props);
    this.state = {}
  }

  render() {
    return (
      <bem.SingleProcessingSubmissionDetails>
        details hi!
      </bem.SingleProcessingSubmissionDetails>
    )
  }
}
