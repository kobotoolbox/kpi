import React from 'react';
import singleProcessingStore from 'js/components/processing/singleProcessingStore';
import StepBegin from './stepBegin.component';
import StepConfig from './stepConfig.component';
import StepConfigAuto from './stepConfigAuto.component';
import StepEditor from './stepEditor.component';
import StepSingleViewer from './stepSingleViewer.component';
import type {LanguageCode} from 'js/components/languages/languagesStore';

interface TranslationsTabState {
  selectedTranslation?: LanguageCode;
}

export default class TranslationsTab extends React.Component<
  {},
  TranslationsTabState
> {
  constructor(props: {}) {
    super(props);

    this.state = {
      // We want to always have a translation selected when there is at least
      // one, so we preselect it on the initialization.
      selectedTranslation: this.getDefaultSelectedTranslation(),
    };
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
    const draft = singleProcessingStore.getTranslationDraft();

    // When we save a new translation, we can preselect it, as it already exist
    // in the store.
    if (draft?.languageCode) {
      this.selectTranslation(draft.languageCode);
    }

    // When the selected translation was removed, we select another one.
    if (
      draft === undefined &&
      singleProcessingStore.getTranslation(this.state.selectedTranslation) ===
        undefined
    ) {
      this.selectTranslation(this.getDefaultSelectedTranslation());
    }

    this.forceUpdate();
  }

  getDefaultSelectedTranslation() {
    let selected;
    const storedTranslations = singleProcessingStore.getTranslations();
    if (storedTranslations.length >= 1) {
      selected = storedTranslations[0].languageCode;
    }
    return selected;
  }

  selectTranslation(languageCode?: LanguageCode) {
    this.setState({selectedTranslation: languageCode});
  }

  /** Identifies what step should be displayed based on the data itself. */
  render() {
    const draft = singleProcessingStore.getTranslationDraft();

    // Step 1: Begin - the step where there is nothing yet.
    if (
      singleProcessingStore.getTranslations().length === 0 &&
      draft === undefined
    ) {
      return <StepBegin />;
    }

    // Step 2: Config - for selecting the translation language and mode.
    // We display it when there is ongoing draft, but it doesn't have a language 
    // or a value, and the region code is not selected.
    if (
      draft !== undefined &&
      (draft.languageCode === undefined || draft.value === undefined) &&
      draft.regionCode === undefined
    ) {
      return <StepConfig />;
    }

    // Step 2.1: Config Automatic - for selecting region and other automatic
    // options.
    // We display it when there is ongoing draft, but it doesn't have a language 
    // or a value, and the region code is selected.
    if (
      draft !== undefined &&
      (draft.languageCode === undefined || draft.value === undefined) &&
      draft.regionCode !== undefined
    ) {
      return <StepConfigAuto />;
    }

    // Step 3: Editor - display editor of draft translation.
    if (draft !== undefined) {
      return (
        <StepEditor
          selectedTranslation={this.state.selectedTranslation}
          onRequestSelectTranslation={this.selectTranslation.bind(this)}
        />
      );
    }

    // Step 4: Viewer - display existing (on backend) and selected translation.
    // We display it when there is selected translation, and there are 
    // translations in the store, and there is no ongoing draft.
    if (
      (singleProcessingStore.getTranslation(this.state.selectedTranslation) !==
        undefined ||
        singleProcessingStore.getTranslations().length >= 1) &&
      draft === undefined
    ) {
      return (
        <StepSingleViewer
          selectedTranslation={this.state.selectedTranslation}
          onRequestSelectTranslation={this.selectTranslation.bind(this)}
        />
      );
    }

    // Should not happen, but we need to return something.
    return null;
  }
}
