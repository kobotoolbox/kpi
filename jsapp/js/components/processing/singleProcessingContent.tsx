import React from 'react';
import singleProcessingStore from 'js/components/processing/singleProcessingStore';
import AnalysisTab from 'js/components/processing/analysis/analysisTab.component';
import TranscriptTab from 'js/components/processing/transcript/transcriptTab.component';
import TranslationsTab from 'js/components/processing/translations/translationsTab.component';
import protectorHelpers from 'js/protector/protectorHelpers';
import {
  goToTabRoute,
  isProcessingRouteActive,
} from 'js/components/processing/routes.utils';
import {PROCESSING_ROUTES} from 'js/router/routerConstants';
import styles from './singleProcessingContent.module.scss';
import classNames from 'classnames';

/**
 * Displays main content part of Single Processing route. It consists of tabs
 * navigation and a section for currently selected tab. Content for each of the
 * tabs is built in separate components.
 */
export default class SingleProcessingContent extends React.Component<{}> {
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
   * Don't want to store a duplicate of `activeTab` here, so we need to make
   * the component re-render itself when the store changes :shrug:.
   */
  onSingleProcessingStoreChange() {
    this.forceUpdate();
  }

  /** DRY wrapper for protector function. */
  safeExecute(callback: () => void) {
    protectorHelpers.safeExecute(
      singleProcessingStore.hasAnyUnsavedWork(),
      callback
    );
  }

  renderTabContent() {
    if (isProcessingRouteActive(PROCESSING_ROUTES.TRANSCRIPT)) {
      return <TranscriptTab />;
    }
    if (isProcessingRouteActive(PROCESSING_ROUTES.TRANSLATIONS)) {
      return <TranslationsTab />;
    }
    if (isProcessingRouteActive(PROCESSING_ROUTES.ANALYSIS)) {
      return <AnalysisTab />;
    }
    return null;
  }

  render() {
    return (
      <section className={styles.root}>
        <ul className={styles.tabs}>
          <li
            className={classNames({
              [styles.tab]: true,
              [styles.activeTab]: isProcessingRouteActive(PROCESSING_ROUTES.TRANSCRIPT),
            })}
            onClick={this.safeExecute.bind(
              this,
              () => goToTabRoute(PROCESSING_ROUTES.TRANSCRIPT)
            )}
          >
            {t('Transcript')}
          </li>

          <li
            className={classNames({
              [styles.tab]: true,
              [styles.activeTab]: isProcessingRouteActive(PROCESSING_ROUTES.TRANSLATIONS),
            })}
            onClick={this.safeExecute.bind(
              this,
              () => goToTabRoute(PROCESSING_ROUTES.TRANSLATIONS)
            )}
          >
            {t('Translations')}
          </li>

          <li
            className={classNames({
              [styles.tab]: true,
              [styles.activeTab]: isProcessingRouteActive(PROCESSING_ROUTES.ANALYSIS),
            })}
            onClick={this.safeExecute.bind(
              this,
              () => goToTabRoute(PROCESSING_ROUTES.ANALYSIS)
            )}
          >
            {t('Analysis')}
          </li>
        </ul>

        <section className={styles.body}>{this.renderTabContent()}</section>
      </section>
    );
  }
}
