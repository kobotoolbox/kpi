import React from 'react';
import clonedeep from 'lodash.clonedeep';
import {formatTime} from 'js/utils';
import singleProcessingStore from 'js/components/processing/singleProcessingStore';
import TransxAutomaticButton from 'js/components/processing/transxAutomaticButton';
import LanguageSelector, {
  resetAllLanguageSelectors,
} from 'js/components/languages/languageSelector';
import RegionSelector from 'js/components/languages/regionSelector';
import Button from 'js/components/common/button';
import {destroyConfirm} from 'js/alertify';
import type {
  DetailedLanguage,
  LanguageCode,
  ListLanguage,
} from 'js/components/languages/languagesStore';
import {AsyncLanguageDisplayLabel} from 'js/components/languages/languagesUtils';
import envStore from 'js/envStore';
import bodyStyles from 'js/components/processing/processingBody.module.scss';
import classNames from 'classnames';

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

  /** Changes the draft language, preserving the other draft properties. */
  onLanguageChange(newVal: DetailedLanguage | ListLanguage | null) {
    const newDraft =
      clonedeep(singleProcessingStore.getTranscriptDraft()) || {};
    newDraft.languageCode = newVal?.code;
    singleProcessingStore.setTranscriptDraft(newDraft);
  }

  /** Changes the draft region, preserving the other draft properties. */
  onRegionChange(newVal: LanguageCode | null | undefined) {
    const newDraft =
      clonedeep(singleProcessingStore.getTranscriptDraft()) || {};
    newDraft.regionCode = newVal;
    singleProcessingStore.setTranscriptDraft(newDraft);
  }

  /** Changes the draft value, preserving the other draft properties. */
  setDraftValue(newVal: string | undefined) {
    const newDraft =
      clonedeep(singleProcessingStore.getTranscriptDraft()) || {};
    newDraft.value = newVal;
    singleProcessingStore.setTranscriptDraft(newDraft);
  }

  onDraftValueChange(evt: React.ChangeEvent<HTMLTextAreaElement>) {
    this.setDraftValue(evt.target.value);
  }

  begin() {
    // Make an empty draft.
    singleProcessingStore.setTranscriptDraft({});
  }

  selectModeManual() {
    // Initialize draft value.
    this.setDraftValue('');
  }

  selectModeAuto() {
    // The `null` value tells us that no region was selected yet, but we are
    // interested in regions right now - i.e. when this property exists (is
    // defined) we show the automatic service configuration step.
    this.onRegionChange(null);
  }

  requestAutoTranscription() {
    singleProcessingStore.requestAutoTranscription();
  }

  /** Goes back from the automatic service configuration step. */
  cancelAuto() {
    this.onRegionChange(undefined);
  }

  back() {
    const draft = singleProcessingStore.getTranscriptDraft();
    if (
      draft !== undefined &&
      draft?.languageCode === undefined &&
      draft?.value === undefined
    ) {
      this.discardDraft();
    }

    if (
      draft !== undefined &&
      draft?.languageCode !== undefined &&
      draft?.value === undefined
    ) {
      singleProcessingStore.setTranslationDraft({});
      resetAllLanguageSelectors();
    }
  }

  discardDraft() {
    if (singleProcessingStore.hasUnsavedTranscriptDraftValue()) {
      destroyConfirm(
        singleProcessingStore.deleteTranscriptDraft.bind(singleProcessingStore),
        t('Discard unsaved changes?'),
        t('Discard')
      );
    } else {
      singleProcessingStore.deleteTranscriptDraft();
    }
  }

  saveDraft() {
    const draft = singleProcessingStore.getTranscriptDraft();
    if (draft?.languageCode !== undefined && draft?.value !== undefined) {
      singleProcessingStore.setTranscript(draft.languageCode, draft.value);
    }
  }

  openEditor() {
    const transcript = singleProcessingStore.getTranscript();
    if (transcript) {
      // Make new draft using existing transcript.
      singleProcessingStore.setTranscriptDraft(transcript);
    }
  }

  deleteTranscript() {
    destroyConfirm(
      singleProcessingStore.deleteTranscript.bind(singleProcessingStore),
      t('Delete transcript?')
    );
  }

  /** Whether automatic services are available for current user. */
  isAutoEnabled() {
    return envStore.data.asr_mt_features_enabled;
  }

  renderLanguageAndDate() {
    const storeTranscript = singleProcessingStore.getTranscript();
    const draft = singleProcessingStore.getTranscriptDraft();
    const valueLanguageCode =
      draft?.languageCode || storeTranscript?.languageCode;
    if (valueLanguageCode === undefined) {
      return null;
    }

    let dateText = '';
    if (storeTranscript) {
      if (storeTranscript.dateCreated !== storeTranscript?.dateModified) {
        dateText = t('last modified ##date##').replace(
          '##date##',
          formatTime(storeTranscript.dateModified)
        );
      } else {
        dateText = t('created ##date##').replace(
          '##date##',
          formatTime(storeTranscript.dateCreated)
        );
      }
    }

    return (
      <React.Fragment>
        <label className={bodyStyles.transxHeaderLanguage}>
          <AsyncLanguageDisplayLabel code={valueLanguageCode} />
        </label>

        {dateText !== '' && (
          <time className={bodyStyles.transxHeaderDate}>{dateText}</time>
        )}
      </React.Fragment>
    );
  }

  renderStepBegin() {
    const typeLabel =
      singleProcessingStore.currentQuestionType || t('source file');
    return (
      <div className={classNames(bodyStyles.root, bodyStyles.stepBegin)}>
        <header className={bodyStyles.header}>
          {t('This ##type## does not have a transcript yet').replace(
            '##type##',
            typeLabel
          )}
        </header>

        <Button
          type='full'
          color='blue'
          size='l'
          label={t('begin')}
          onClick={this.begin.bind(this)}
        />
      </div>
    );
  }

  renderStepConfig() {
    const draft = singleProcessingStore.getTranscriptDraft();

    const typeLabel =
      singleProcessingStore.currentQuestionType || t('source file');
    const languageSelectorTitle = t(
      'Please select the original language of the ##type##'
    ).replace('##type##', typeLabel);

    return (
      <div className={classNames(bodyStyles.root, bodyStyles.stepConfig)}>
        <LanguageSelector
          titleOverride={languageSelectorTitle}
          onLanguageChange={this.onLanguageChange.bind(this)}
          suggestedLanguages={singleProcessingStore.getAssetTranscriptableLanguages()}
        />

        <footer className={bodyStyles.footer}>
          <Button
            type='bare'
            color='blue'
            size='m'
            label={t('back')}
            startIcon='caret-left'
            onClick={this.back.bind(this)}
            isDisabled={singleProcessingStore.isFetchingData}
          />

          <div className={bodyStyles.footerRightButtons}>
            <Button
              type='frame'
              color='blue'
              size='m'
              label={this.isAutoEnabled() ? t('manual') : t('transcribe')}
              onClick={this.selectModeManual.bind(this)}
              isDisabled={
                draft?.languageCode === undefined ||
                singleProcessingStore.isFetchingData
              }
            />

            <TransxAutomaticButton
              onClick={this.selectModeAuto.bind(this)}
              selectedLanguage={draft?.languageCode}
              type='transcript'
            />
          </div>
        </footer>
      </div>
    );
  }

  renderStepConfigAuto() {
    const draft = singleProcessingStore.getTranscriptDraft();

    if (draft?.languageCode === undefined) {
      return null;
    }

    return (
      <div className={classNames(bodyStyles.root, bodyStyles.stepConfig)}>
        <header className={bodyStyles.header}>
          {t('Automatic transcription of audio file from')}
        </header>

        <RegionSelector
          isDisabled={
            singleProcessingStore.isFetchingData ||
            singleProcessingStore.isPollingForTranscript
          }
          serviceCode='goog'
          serviceType='transcription'
          rootLanguage={draft.languageCode}
          onRegionChange={this.onRegionChange.bind(this)}
          onCancel={this.cancelAuto.bind(this)}
        />

        <h2>{t('Transcription provider')}</h2>

        <p>
          {t(
            'Automated transcription is provided by Google Cloud Platform. By ' +
              'using this service you agree that your audio file will be sent to ' +
              "Google's servers for the purpose of transcribing. However, it will " +
              "not be stored on Google's servers beyond the short period needed for " +
              'completing the transcription, and we do not allow Google to use the ' +
              'audio for improving its transcription service.'
          )}
        </p>

        <footer className={bodyStyles.footer}>
          <div className={bodyStyles.footerCenterButtons}>
            <Button
              type='frame'
              color='blue'
              size='m'
              label={t('cancel')}
              onClick={this.cancelAuto.bind(this)}
              isDisabled={
                singleProcessingStore.isFetchingData ||
                singleProcessingStore.isPollingForTranscript
              }
            />

            <Button
              type='full'
              color='blue'
              size='m'
              label={
                singleProcessingStore.isPollingForTranscript
                  ? t('in progress')
                  : t('create transcript')
              }
              onClick={this.requestAutoTranscription.bind(this)}
              isDisabled={
                singleProcessingStore.isFetchingData ||
                singleProcessingStore.isPollingForTranscript
              }
            />
          </div>
        </footer>
      </div>
    );
  }

  renderStepEditor() {
    const draft = singleProcessingStore.getTranscriptDraft();

    // The discard button will become a back button when there are no unsaved changes.
    let discardLabel = t('Back');
    if (singleProcessingStore.hasUnsavedTranscriptDraftValue()) {
      discardLabel = t('Discard');
    }

    return (
      <div className={bodyStyles.root}>
        <header className={bodyStyles.transxHeader}>
          {this.renderLanguageAndDate()}

          <nav className={bodyStyles.transxHeaderButtons}>
            <Button
              type='frame'
              color='blue'
              size='s'
              label={discardLabel}
              onClick={this.discardDraft.bind(this)}
              isDisabled={singleProcessingStore.isFetchingData}
            />

            <Button
              type='full'
              color='blue'
              size='s'
              label={t('Save')}
              onClick={this.saveDraft.bind(this)}
              isPending={singleProcessingStore.isFetchingData}
              isDisabled={
                !singleProcessingStore.hasUnsavedTranscriptDraftValue()
              }
            />
          </nav>
        </header>

        <textarea
          className={bodyStyles.textarea}
          value={draft?.value}
          onChange={this.onDraftValueChange.bind(this)}
          disabled={singleProcessingStore.isFetchingData}
        />
      </div>
    );
  }

  renderStepViewer() {
    return (
      <div className={bodyStyles.root}>
        <header className={bodyStyles.transxHeader}>
          {this.renderLanguageAndDate()}

          <nav className={bodyStyles.transxHeaderButtons}>
            <Button
              type='bare'
              color='storm'
              size='s'
              startIcon='edit'
              onClick={this.openEditor.bind(this)}
              tooltip={t('Edit')}
              isDisabled={singleProcessingStore.isFetchingData}
            />

            <Button
              type='bare'
              color='storm'
              size='s'
              startIcon='trash'
              onClick={this.deleteTranscript.bind(this)}
              tooltip={t('Delete')}
              isPending={singleProcessingStore.isFetchingData}
            />
          </nav>
        </header>

        <article className={bodyStyles.text}>
          {singleProcessingStore.getTranscript()?.value}
        </article>
      </div>
    );
  }

  /** Identifies what step should be displayed based on the data itself. */
  render() {
    const draft = singleProcessingStore.getTranscriptDraft();

    // Step 1: Begin - the step where there is nothing yet.
    if (
      singleProcessingStore.getTranscript() === undefined &&
      draft === undefined
    ) {
      return this.renderStepBegin();
    }

    // Step 2: Config - for selecting the transcript language and mode.
    if (
      draft !== undefined &&
      (draft.languageCode === undefined || draft.value === undefined) &&
      draft.regionCode === undefined
    ) {
      return this.renderStepConfig();
    }

    // Step 2.1: Config Automatic - for selecting region and other automatic options
    if (
      draft !== undefined &&
      (draft.languageCode === undefined || draft.value === undefined) &&
      draft.regionCode !== undefined
    ) {
      return this.renderStepConfigAuto();
    }

    // Step 3: Editor - display editor of draft transcript.
    if (draft !== undefined) {
      return this.renderStepEditor();
    }

    // Step 4: Viewer - display existing (on backend) transcript.
    if (
      singleProcessingStore.getTranscript() !== undefined &&
      draft === undefined
    ) {
      return this.renderStepViewer();
    }

    // Should not happen, but we need to return something.
    return null;
  }
}
