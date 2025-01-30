import React from 'react';
import singleProcessingStore from 'js/components/processing/singleProcessingStore';
import StepBegin from './stepBegin.component';
import StepConfig from './stepConfig.component';
import StepConfigAuto from './stepConfigAuto.component';
import StepEditor from './stepEditor.component';
import StepViewer from './stepViewer.component';

export default class TranscriptTab extends React.Component<{}> {
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

  /** Identifies what step should be displayed based on the data itself. */
  render() {
    const draft = singleProcessingStore.getTranscriptDraft();

    // Step 1: Begin - the step where there is nothing yet.
    if (
      singleProcessingStore.getTranscript() === undefined &&
      draft === undefined
    ) {
      return <StepBegin />;
    }

    // Step 2: Config - for selecting the transcript language and mode.
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

    // Step 3: Editor - display editor of draft transcript.
    if (draft !== undefined) {
      return <StepEditor />;
    }

    // Step 4: Viewer - display existing (on backend) transcript.
    // We display it when there is transcript in the store, and there is no
    // ongoing draft (we only support single transcript ATM).
    if (
      singleProcessingStore.getTranscript() !== undefined &&
      draft === undefined
    ) {
      return <StepViewer />;
    }

    // Should not happen, but we need to return something.
    return null;
  }
}
