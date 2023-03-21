import React from 'react';
import {formatTime} from 'js/utils';
import singleProcessingStore, {
  SingleProcessingTabs,
} from 'js/components/processing/singleProcessingStore';
import TransxSelector from './transxSelector';
import styles from './singleProcessingPreview.module.scss';
import bodyStyles from './processingBody.module.scss';
import {AsyncLanguageDisplayLabel} from 'js/components/languages/languagesUtils';
import type {LanguageCode} from 'js/components/languages/languagesStore';

/**
 * Shows a source (transcript or translation) for new translation. This is being
 * rendered by the side of the content.
 */
export default class SingleProcessingPreview extends React.Component {
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

  renderLanguageAndDate() {
    const source = singleProcessingStore.getSourceData();

    const contentLanguageCode = source?.languageCode;
    if (contentLanguageCode === undefined) {
      return null;
    }

    let dateText = '';
    if (source) {
      if (source.dateCreated !== source?.dateModified) {
        dateText = t('last modified ##date##').replace(
          '##date##',
          formatTime(source.dateModified)
        );
      } else {
        dateText = t('created ##date##').replace(
          '##date##',
          formatTime(source.dateCreated)
        );
      }
    }

    return (
      <React.Fragment>
        {this.renderLanguage()}

        {dateText !== '' && (
          <time className={bodyStyles.transxHeaderDate}>
            {dateText}
          </time>
        )}
      </React.Fragment>
    );
  }

  /**
   * Renders a text (for one possible source) or a Translations Selector
   * for multiple.
   */
  renderLanguage() {
    const sources = singleProcessingStore.getSources();
    const sourceData = singleProcessingStore.getSourceData();

    if (sources.length === 0 || sourceData?.languageCode === undefined) {
      return null;
    }

    // If there is only one source, we display it as a text.
    if (sources.length === 1) {
      return (
        <label className={bodyStyles.transxHeaderLanguage}>
          <AsyncLanguageDisplayLabel code={sourceData.languageCode} />
        </label>
      );
    }

    if (sources.length >= 2) {
      return (
        <label className={bodyStyles.transxHeaderLanguage}>
          <TransxSelector
            languageCodes={sources}
            selectedLanguage={sourceData.languageCode}
            onChange={(newSelectedOption: LanguageCode | null) => {
              if (newSelectedOption !== null) {
                singleProcessingStore.setSource(newSelectedOption);
              }
            }}
          />
        </label>
      );
    }

    return null;
  }

  render() {
    const source = singleProcessingStore.getSourceData();

    if (
      source &&
      singleProcessingStore.getActiveTab() === SingleProcessingTabs.Translations
    ) {
      return (
        <section className={styles.root}>
          <div className={bodyStyles.root}>
            <header className={bodyStyles.transxHeader}>
              {this.renderLanguageAndDate()}
            </header>

            <article className={bodyStyles.text}>
              {singleProcessingStore.getSourceData()?.value}
            </article>
          </div>
        </section>
      );
    }

    return null;
  }
}
