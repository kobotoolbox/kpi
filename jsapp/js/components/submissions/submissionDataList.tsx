import React from 'react';
import bem, {makeBem} from 'js/bem';
import './submissionDataList.scss';

bem.SubmissionDataList = makeBem(null, 'submission-data-list', 'ul')

type SubmissionDataListProps = {
  assetContent: AssetContent
  submissionData: SubmissionResponse
  /** Whether to hide meta type question from the rendered list. */
  hideMeta?: boolean
}

type SubmissionDataListState = {}

export default class SubmissionDataList extends React.Component<
  SubmissionDataListProps,
  SubmissionDataListState
> {
  constructor(props: SubmissionDataListProps) {
    super(props);
    this.state = {}
  }

  render() {
    return (
      <bem.SubmissionDataList>
        submission data list hi!
      </bem.SubmissionDataList>
    )
  }
}
