import React from 'react';
import type {RouteComponentProps} from 'react-router';
import {
  getSurveyFlatPaths,
  isRowProcessingEnabled,
} from 'js/assetUtils';
import assetStore from 'js/assetStore';
import bem, {makeBem} from 'js/bem';
import type {AnyRowTypeName} from 'js/constants';
import LoadingSpinner from 'js/components/common/loadingSpinner';
import SingleProcessingHeader from 'js/components/processing/singleProcessingHeader';
import SingleProcessingSubmissionDetails from 'js/components/processing/singleProcessingSubmissionDetails';
import SingleProcessingContent from 'js/components/processing/singleProcessingContent';
import SingleProcessingPreview from 'js/components/processing/singleProcessingPreview';
import singleProcessingStore from 'js/components/processing/singleProcessingStore';
import WorkProtector from 'js/protector/workProtector';
import './singleProcessing.scss';
import type AssetResponse from 'js/dataInterface';

bem.SingleProcessing = makeBem(null, 'single-processing', 'section');
bem.SingleProcessing__top = makeBem(bem.SingleProcessing, 'top', 'section');
bem.SingleProcessing__bottom = makeBem(bem.SingleProcessing, 'bottom', 'section');
bem.SingleProcessing__bottomLeft = makeBem(bem.SingleProcessing, 'bottom-left', 'section');
bem.SingleProcessing__bottomRight = makeBem(bem.SingleProcessing, 'bottom-right', 'section');

type SingleProcessingRouteProps = RouteComponentProps<{
  uid: string;
  questionName: string;
  submissionUuid: string;
}>;

interface SingleProcessingRouteState {
  asset: AssetResponse | undefined;
}

/**
 * This route component is being loaded with PermProtectedRoute so we know that
 * the call to backend to get asset was already made :happy_face:
 */
export default class SingleProcessingRoute extends React.Component<
  SingleProcessingRouteProps,
  SingleProcessingRouteState
> {
  constructor(props: SingleProcessingRouteProps) {
    super(props);
    this.state = {
      asset: assetStore.getAsset(this.props.params.uid),
    };
  }

  private unlisteners: Array<() => void> = [];

  componentDidMount() {
    this.unlisteners.push(
      singleProcessingStore.listen(this.onSingleProcessingStoreChange, this)
    );
  }

  componentWillUnmount() {
    this.unlisteners.forEach((clb) => {clb();});
  }

  /**
  * Don't want to store a duplicate of store data here just for the sake of
  * comparison, so we need to make the component re-render itself when the
  * store changes :shrug:.
  */
  onSingleProcessingStoreChange() {
    this.forceUpdate();
  }

  getQuestionPath() {
    let questionFlatPath: string | undefined;
    if (this.state.asset?.content?.survey !== undefined) {
      const flatPaths = getSurveyFlatPaths(this.state.asset.content.survey);
      questionFlatPath = flatPaths[this.props.params.questionName];
    }
    return questionFlatPath;
  }

  getQuestionType(): AnyRowTypeName | undefined {
    if (this.state.asset?.content?.survey) {
      const foundRow = this.state.asset.content.survey.find((row) =>
        [row.name, row.$autoname, row.$kuid].includes(this.props.params.questionName)
      );
      if (foundRow) {
        return foundRow.type;
      }
    }
    return undefined;
  }

  /** Whether the question and submission uuid pair make sense for processing. */
  isDataValid() {
    const uuids = singleProcessingStore.getSubmissionsUuids();
    const hasSubmissionAnyProcessableData = uuids?.[this.props.params.questionName]?.includes(this.props.params.submissionUuid);

    return (
      // To prepare UI for questions that are not processing-enabled.
      isRowProcessingEnabled(
        this.props.params.uid,
        this.props.params.questionName
      ) &&
      // To prepare UI for submissions (uuids) that don't contain any processable data.
      hasSubmissionAnyProcessableData
    );
  }

  render() {
    if (
      !singleProcessingStore.isReady() ||
      !this.state.asset?.content?.survey
    ) {
      return (
        <bem.SingleProcessing>
          <LoadingSpinner/>
        </bem.SingleProcessing>
      );
    }

    return (
      <bem.SingleProcessing>
        <WorkProtector
          shouldProtect={singleProcessingStore.hasAnyUnsavedWork()}
          currentRoute={this.props.route}
          router={this.props.router}
        />
        <bem.SingleProcessing__top>
          <SingleProcessingHeader
            questionType={this.getQuestionType()}
            questionName={this.props.params.questionName}
            submissionUuid={this.props.params.submissionUuid}
            assetUid={this.props.params.uid}
            assetContent={this.state.asset.content}
          />
        </bem.SingleProcessing__top>

        <bem.SingleProcessing__bottom>
          {!singleProcessingStore.isReady() &&
            <LoadingSpinner/>
          }
          {this.isDataValid() && singleProcessingStore.isReady() &&
            <bem.SingleProcessing__bottomLeft>
              <SingleProcessingPreview/>

              <SingleProcessingSubmissionDetails
                questionType={this.getQuestionType()}
                questionName={this.props.params.questionName}
                assetContent={this.state.asset.content}
              />
            </bem.SingleProcessing__bottomLeft>
          }
          {this.isDataValid() && singleProcessingStore.isReady() &&
            <bem.SingleProcessing__bottomRight>
              <SingleProcessingContent
                questionType={this.getQuestionType()}
              />
            </bem.SingleProcessing__bottomRight>
          }
          {!this.isDataValid() &&
            <bem.Loading>
              <bem.Loading__inner>
                {t('Processing feature is not available for current question and submission pair.')}
              </bem.Loading__inner>
            </bem.Loading>
          }
        </bem.SingleProcessing__bottom>
      </bem.SingleProcessing>
    );
  }
}
