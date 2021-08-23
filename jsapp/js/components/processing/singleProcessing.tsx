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
  isReady: boolean
  submissionData: SubmissionResponse | null
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
      isReady: false,
      submissionData: null,
      asset: assetStore.getAsset(this.props.params.uid),
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

  getQuestionType(): QuestionTypeName | undefined {
    if (this.state.asset?.content) {
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
    if (!this.state.isReady || !this.state.asset || !this.state.asset.content) {
      return <LoadingSpinner/>;
    }

    return (
      <bem.SingleProcessing>
        <bem.SingleProcessing__top>
          <SingleProcessingHeader
            questionType={this.getQuestionType()}
            questionName={getTranslatedRowLabel(this.props.params.questionName, this.state.asset.content.survey, 0)}
            submissionId={this.props.params.submissionId}
            totalSubmissions={this.state.asset.deployment__submission_count}
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
