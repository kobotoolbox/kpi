import React from 'react';
import envStore from 'js/envStore';
import {formatTime} from 'js/utils';
import bem, {makeBem} from 'js/bem';
import singleProcessingStore, {SingleProcessingTabs} from 'js/components/processing/singleProcessingStore';
import KoboSelect from 'js/components/common/koboSelect';
import type {KoboSelectOption} from 'js/components/common/koboSelect';
import './singleProcessingPreview.scss';

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
        <bem.ProcessingBody__transxHeaderLanguage>
          {envStore.getLanguageDisplayLabel(sourceData.languageCode)}
        </bem.ProcessingBody__transxHeaderLanguage>
      );
    }

    if (sources.length >= 2) {
      const selectOptions: KoboSelectOption[] = [];
      sources.forEach((source) => {
        selectOptions.push({
          id: source,
          label: envStore.getLanguageDisplayLabel(source),
        });
      });

      return (
        <bem.ProcessingBody__transxHeaderLanguage>
          <KoboSelect
            name='single-processing-preview-language-switcher'
            type='blue'
            size='s'
            selectedOption={sourceData.languageCode}
            options={selectOptions}
            onChange={(newSelectedOption: string) => {
              singleProcessingStore.setSource(newSelectedOption);
            }}
          />
        </bem.ProcessingBody__transxHeaderLanguage>
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
