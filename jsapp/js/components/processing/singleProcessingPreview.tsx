import React from 'react';
import {formatTime} from 'js/utils';
import bem, {makeBem} from 'js/bem';
import singleProcessingStore, {SingleProcessingTabs} from 'js/components/processing/singleProcessingStore';
import TransxSelector from './transxSelector';
import './singleProcessingPreview.scss';
import {AsyncLanguageDisplayLabel} from 'js/components/languages/languagesUtils';

bem.SingleProcessingPreview = makeBem(null, 'single-processing-preview', 'section');

/** Shows a source (transcript or translation) for new translation. */
export default class SingleProcessingPreview extends React.Component {
  private unlisteners: Function[] = [];

  componentDidMount() {
    this.unlisteners.push(
      singleProcessingStore.listen(this.onSingleProcessingStoreChange, this)
    );
  }

  componentWillUnmount() {
    this.unlisteners.forEach((clb) => {clb();});
  }

  onSingleProcessingStoreChange() {
    /**
     * Don't want to store a duplicate of `activeTab` here, so we need to make
     * the component re-render itself when the store changes :shrug:.
     */
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
        dateText = t('last modified ##date##').replace('##date##', formatTime(source.dateModified));
      } else {
        dateText = t('created ##date##').replace('##date##', formatTime(source.dateCreated));
      }
    }

    return (
      <React.Fragment>
        {this.renderLanguage()}

        {dateText !== '' &&
          <bem.ProcessingBody__transxHeaderDate>
            {dateText}
          </bem.ProcessingBody__transxHeaderDate>
        }
      </React.Fragment>
    );
  }

  /** Renders a text or a selector of translations. */
  renderLanguage() {
    const sources = singleProcessingStore.getSources();
    const sourceData = singleProcessingStore.getSourceData();

    if (sources.length === 0 || sourceData?.languageCode === undefined) {
      return null;
    }

    // If there is only one source, we display it as a text.
    if (sources.length === 1) {
      return (
        <bem.ProcessingBody__transxHeaderLanguageWrapper>
          {t('Language')}
          <bem.ProcessingBody__transxHeaderLanguage>
            <AsyncLanguageDisplayLabel code={sourceData.languageCode}/>
          </bem.ProcessingBody__transxHeaderLanguage>
        </bem.ProcessingBody__transxHeaderLanguageWrapper>
      );
    }

    if (sources.length >= 2) {
      return (
        <bem.ProcessingBody__transxHeaderLanguageWrapper>
          {t('Language')}
          <bem.ProcessingBody__transxHeaderLanguage>
            <TransxSelector
              languageCodes={sources}
              selectedLanguage={sourceData.languageCode}
              onChange={(newSelectedOption: string) => {
                singleProcessingStore.setSource(newSelectedOption);
              }}
            />
          </bem.ProcessingBody__transxHeaderLanguage>
        </bem.ProcessingBody__transxHeaderLanguageWrapper>
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
        <bem.SingleProcessingPreview>
          <bem.ProcessingBody>
            <bem.ProcessingBody__transxHeader>
              {this.renderLanguageAndDate()}
            </bem.ProcessingBody__transxHeader>

            <bem.ProcessingBody__text>
              {singleProcessingStore.getSourceData()?.value}
            </bem.ProcessingBody__text>
          </bem.ProcessingBody>
        </bem.SingleProcessingPreview>
      );
    }

    return null;
  }
}
