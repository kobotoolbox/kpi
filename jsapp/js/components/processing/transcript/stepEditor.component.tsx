import React from 'react';
import clonedeep from 'lodash.clonedeep';
import Button from 'js/components/common/button';
import singleProcessingStore from 'js/components/processing/singleProcessingStore';
import HeaderLanguageAndDate from './headerLanguageAndDate.component';
import bodyStyles from 'js/components/processing/processingBody.module.scss';

export default function StepEditor() {
  function discardDraft() {
    singleProcessingStore.safelyDeleteTranscriptDraft();
  }

  function saveDraft() {
    const draft = singleProcessingStore.getTranscriptDraft();
    if (draft?.languageCode !== undefined && draft?.value !== undefined) {
      singleProcessingStore.setTranscript(draft.languageCode, draft.value);
    }
  }

  /** Changes the draft value, preserving the other draft properties. */
  function setDraftValue(evt: React.ChangeEvent<HTMLTextAreaElement>) {
    const newVal = evt.target.value;
    const newDraft =
      clonedeep(singleProcessingStore.getTranscriptDraft()) || {};
    newDraft.value = newVal;
    singleProcessingStore.setTranscriptDraft(newDraft);
  }

  const draft = singleProcessingStore.getTranscriptDraft();

  // The discard button will become a back button when there are no unsaved changes.
  let discardLabel = t('Back');
  if (singleProcessingStore.hasUnsavedTranscriptDraftValue()) {
    discardLabel = t('Discard');
  }

  return (
    <div className={bodyStyles.root}>
      <header className={bodyStyles.transxHeader}>
        <HeaderLanguageAndDate />

        <nav className={bodyStyles.transxHeaderButtons}>
          <Button
            type='frame'
            color='blue'
            size='s'
            label={discardLabel}
            onClick={discardDraft}
            isDisabled={singleProcessingStore.isFetchingData}
          />

          <Button
            type='full'
            color='blue'
            size='s'
            label={t('Save')}
            onClick={saveDraft}
            isPending={singleProcessingStore.isFetchingData}
            isDisabled={!singleProcessingStore.hasUnsavedTranscriptDraftValue()}
          />
        </nav>
      </header>

      <textarea
        className={bodyStyles.textarea}
        value={draft?.value}
        onChange={setDraftValue}
        disabled={singleProcessingStore.isFetchingData}
      />
    </div>
  );
}
