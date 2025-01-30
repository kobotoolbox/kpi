import React from 'react';
import DocumentTitle from 'react-document-title';
import {isRowProcessingEnabled} from 'js/assetUtils';
import type {AssetResponse} from 'js/dataInterface';
import assetStore from 'js/assetStore';
import LoadingSpinner from 'js/components/common/loadingSpinner';
import SingleProcessingHeader from 'js/components/processing/singleProcessingHeader';
import SingleProcessingContent from 'js/components/processing/singleProcessingContent';
import singleProcessingStore from 'js/components/processing/singleProcessingStore';
import ProcessingSidebar from 'js/components/processing/sidebar/processingSidebar';
import {UNSAVED_CHANGES_WARNING} from 'jsapp/js/protector/protectorConstants';
import {unstable_usePrompt as usePrompt} from 'react-router-dom';
import type {WithRouterProps} from 'jsapp/js/router/legacy';
import styles from './singleProcessingRoute.module.scss';
import CenteredMessage from 'js/components/common/centeredMessage.component';

const NO_DATA_MESSAGE = t('There is no data for this question for the current submission');

interface SingleProcessingRouteProps extends WithRouterProps {
  uid: string;
  xpath: string;
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
    if (this.props.params.uid && this.props.params.xpath) {
      return isRowProcessingEnabled(
        this.props.params.uid,
        this.props.params.xpath
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
        <CenteredMessage message={NO_DATA_MESSAGE} />
      );
    }

    if (this.isProcessingEnabled()) {
      return (
        <React.Fragment>
          <section className={styles.bottomLeft}>
            {this.isDataProcessable() && <SingleProcessingContent />}
            {!this.isDataProcessable() && (
              <CenteredMessage message={NO_DATA_MESSAGE} />
            )}
          </section>

          <section className={styles.bottomRight}>
            <ProcessingSidebar asset={this.state.asset} />
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
            singleProcessingStore.data.isPollingForTranscript) && <Prompt />}
          <section className={styles.top}>
            <SingleProcessingHeader
              submissionEditId={this.props.params.submissionEditId}
              assetUid={this.props.params.uid}
              asset={this.state.asset}
            />
          </section>

          <section className={styles.bottom}>{this.renderBottom()}</section>
        </section>
      </DocumentTitle>
    );
  }
}
