import React from 'react';
import bem, {makeBem} from 'js/bem';
import './singleProcessingSubmissionDetails.scss';

bem.SingleProcessingSubmissionDetails = makeBem(null, 'single-processing-submission-details', 'section')

type SingleProcessingSubmissionDetailsProps = {
  assetContent: AssetContent
  submissionData: SubmissionResponse
}

type SingleProcessingSubmissionDetailsState = {}

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
