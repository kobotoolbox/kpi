import React from 'react';
import DocumentTitle from 'react-document-title';
import {isRowProcessingEnabled} from 'js/assetUtils';
import type {AssetResponse} from 'js/dataInterface';
import assetStore from 'js/assetStore';
import LoadingSpinner from 'js/components/common/loadingSpinner';
import SingleProcessingHeader from 'js/components/processing/singleProcessingHeader';
import SingleProcessingSubmissionDetails from 'js/components/processing/singleProcessingSubmissionDetails';
import SingleProcessingContent from 'js/components/processing/singleProcessingContent';
import SingleProcessingPreview from 'js/components/processing/singleProcessingPreview';
import singleProcessingStore from 'js/components/processing/singleProcessingStore';
import {UNSAVED_CHANGES_WARNING} from 'jsapp/js/protector/protectorConstants';
import {unstable_usePrompt as usePrompt} from 'react-router-dom';
import type {WithRouterProps} from 'jsapp/js/router/legacy';
import styles from './singleProcessingRoute.module.scss';

interface SingleProcessingRouteProps extends WithRouterProps {
  uid: string;
  qpath: string;
  submissionEditId: string;
}

const Prompt = () => {
  usePrompt({message: UNSAVED_CHANGES_WARNING, when: true});
  return <></>;
};

interface SingleProcessingRouteState {
  asset: AssetResponse | undefined;
}

/**
 * Provides the base pieces of data for all processing components. Also renders
 * everything with nice spinners.
 */
export default class SingleProcessingRoute extends React.Component<
  SingleProcessingRouteProps,
  SingleProcessingRouteState
> {
  constructor(props: SingleProcessingRouteProps) {
    super(props);
    if (this.props.params.uid) {
      this.state = {
        // NOTE: This route component is being loaded with PermProtectedRoute so
        // we know that the call to backend to get asset was already made, and
        // thus we can safely assume asset data is present :happy_face:
        asset: assetStore.getAsset(this.props.params.uid),
      };
    }
  }

  private unlisteners: Function[] = [];

  componentDidMount() {
    this.unlisteners.push(
      singleProcessingStore.listen(this.onSingleProcessingStoreChange, this)
    );
  }

  componentWillUnmount() {
    this.unlisteners.forEach((clb) => {
      clb();
    });
  }

  /**
   * Don't want to store a duplicate of store data here just for the sake of
   * comparison, so we need to make the component re-render itself when the
   * store changes :shrug:.
   */
  onSingleProcessingStoreChange() {
    this.forceUpdate();
  }

  /** Is processing enabled for current question. */
  isProcessingEnabled() {
    if (this.props.params.uid && this.props.params.qpath) {
      return isRowProcessingEnabled(
        this.props.params.uid,
        this.props.params.qpath
      );
    }
    return false;
  }

  /** Whether current submission has a response for current question. */
  isDataProcessable(): boolean {
    const editIds =
      singleProcessingStore.getCurrentQuestionSubmissionsEditIds();
    if (Array.isArray(editIds)) {
      const currentItem = editIds.find(
        (item) => item.editId === this.props.params.submissionEditId
      );
      if (currentItem) {
        return currentItem.hasResponse;
      }
      return false;
    }
    return false;
  }

  renderBottom() {
    if (
      !singleProcessingStore.isReady() ||
      !this.state.asset?.content?.survey
    ) {
      return <LoadingSpinner />;
    }

    if (!this.isProcessingEnabled()) {
      return (
        <LoadingSpinner
          hideSpinner
          message={t(
            'There is no data for this question for the current submission'
          )}
        />
      );
    }

    if (this.isProcessingEnabled()) {
      return (
        <React.Fragment>
          <section className={styles.bottomLeft}>
            {this.isDataProcessable() && <SingleProcessingContent />}
            {!this.isDataProcessable() && (
              <LoadingSpinner
                hideSpinner
                message={t(
                  'There is no data for this question for the current submission'
                )}
              />
            )}
          </section>

          <section className={styles.bottomRight}>
            <SingleProcessingPreview />

            <SingleProcessingSubmissionDetails
              assetContent={this.state.asset.content}
            />
          </section>
        </React.Fragment>
      );
    }

    return null;
  }

  render() {
    const pageTitle = 'Data | KoboToolbox';

    if (
      !singleProcessingStore.isReady() ||
      !this.state.asset?.content?.survey
    ) {
      return (
        <DocumentTitle title={pageTitle}>
          <section className={styles.root}>
            <LoadingSpinner />
          </section>
        </DocumentTitle>
      );
    }

    return (
      <DocumentTitle title={pageTitle}>
        <section className={styles.root}>
          {(singleProcessingStore.hasAnyUnsavedWork() ||
            singleProcessingStore.isPollingForTranscript) && <Prompt />}
          <section className={styles.top}>
            <SingleProcessingHeader
              submissionEditId={this.props.params.submissionEditId}
              assetUid={this.props.params.uid}
              assetContent={this.state.asset.content}
            />
          </section>

          <section className={styles.bottom}>{this.renderBottom()}</section>
        </section>
      </DocumentTitle>
    );
  }
}
