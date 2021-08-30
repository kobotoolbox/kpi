import React from 'react';
import {RouteComponentProps} from 'react-router';
import {actions} from 'js/actions';
import {getTranslatedRowLabel} from 'js/assetUtils';
import assetStore from 'js/assetStore';
import bem from 'js/bem';
import {QuestionTypeName} from 'js/constants';
import LoadingSpinner from 'js/components/common/loadingSpinner';
import SingleProcessingHeader from 'js/components/processing/singleProcessingHeader';
import './singleProcessing.scss';

bem.SingleProcessing = bem.create('single-processing', 'section');
bem.SingleProcessing__top = bem.SingleProcessing.__('top', 'section');
bem.SingleProcessing__left = bem.SingleProcessing.__('left', 'section');
bem.SingleProcessing__right = bem.SingleProcessing.__('right', 'section');

/**
 * this.props.params properties
 */
type SingleProcessingProps = RouteComponentProps<{
  uid: string,
  questionName: string,
  submissionId: string,
}, {}>;

type SingleProcessingState = {
  isSubmissionCallDone: boolean
  isIdsCallDone: boolean
  submissionData: SubmissionResponse | null
  submissionsIds: string[]
  asset: AssetResponse | undefined
  error: string | null
}

/**
 * This route component is being loaded with PermProtectedRoute so we know that
 * the call to backend to get asset was already made :happy_face:
 */
export default class SingleProcessing extends React.Component<SingleProcessingProps, SingleProcessingState> {
  constructor(props: SingleProcessingProps) {
    super(props);
    this.state = {
      isSubmissionCallDone: false,
      isIdsCallDone: false,
      submissionData: null,
      submissionsIds: [],
      asset: assetStore.getAsset(this.props.params.uid),
      error: null,
    }
  }

  componentDidMount() {
    // TODO: instead of using `getSubmission` we will use `getSubmissions` and paginate id by 1
    // that way we always know what the total number is, what the current number is and we even get
    // next and previous links for free :mindblown:
    actions.submissions.getSubmission.completed.listen(this.onGetSubmissionCompleted.bind(this))
    actions.submissions.getSubmission.failed.listen(this.onGetSubmissionFailed.bind(this))
    actions.submissions.getSubmissionsIds.completed.listen(this.onGetSubmissionsIdsCompleted.bind(this))
    actions.submissions.getSubmissionsIds.failed.listen(this.onGetSubmissionsIdsFailed.bind(this))
    actions.submissions.getSubmission(this.props.params.uid, this.props.params.submissionId);
    actions.submissions.getSubmissionsIds(this.props.params.uid);
  }

  onGetSubmissionCompleted(response: SubmissionResponse): void {
    this.setState({
      isSubmissionCallDone: true,
      submissionData: response,
    });
  }

  onGetSubmissionFailed(response: FailResponse): void {
    this.setState({
      isSubmissionCallDone: true,
      error: response.responseJSON?.detail || t('Failed to get submission.'),
    });
  }

  onGetSubmissionsIdsCompleted(response: GetSubmissionsIdsResponse) {
    this.setState({
      isIdsCallDone: true,
      submissionsIds: response.results.map((result) => String(result._id))
    })
  }

  onGetSubmissionsIdsFailed(response: FailResponse): void {
    this.setState({
      isIdsCallDone: true,
      error: response.responseJSON?.detail || t('Failed to get submissions IDs.'),
    });
  }

  getQuestionType(): QuestionTypeName | undefined {
    if (this.state.asset?.content?.survey) {
      const foundRow = this.state.asset.content.survey.find((row) => {
        return [
          row.name,
          row.$autoname,
          row.$kuid
        ].includes(this.props.params.questionName)
      });
      if (foundRow) {
        return foundRow.type;
      }
    }
    return undefined;
  }

  render() {
    if (
      !this.state.isSubmissionCallDone ||
      !this.state.isIdsCallDone ||
      !this.state.asset ||
      !this.state.asset.content ||
      !this.state.asset.content.survey
    ) {
      return <LoadingSpinner/>;
    }

    console.log(
      this.state.submissionData,
      this.state.submissionsIds
    )

    return (
      <bem.SingleProcessing>
        <bem.SingleProcessing__top>
          <SingleProcessingHeader
            questionType={this.getQuestionType()}
            questionName={getTranslatedRowLabel(this.props.params.questionName, this.state.asset.content.survey, 0)}
            submissionId={this.props.params.submissionId}
            submissionsIds={this.state.submissionsIds}
          />
        </bem.SingleProcessing__top>

        <bem.SingleProcessing__left>
          left
        </bem.SingleProcessing__left>

        <bem.SingleProcessing__right>
          right
        </bem.SingleProcessing__right>
      </bem.SingleProcessing>
    )
  }
}
