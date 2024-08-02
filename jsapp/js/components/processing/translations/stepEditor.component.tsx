import React from 'react';
import clonedeep from 'lodash.clonedeep';
import Button from 'js/components/common/button';
import singleProcessingStore from 'js/components/processing/singleProcessingStore';
import HeaderLanguageAndDate from './headerLanguageAndDate.component';
import type {LanguageCode} from 'js/components/languages/languagesStore';
import bodyStyles from 'js/components/processing/processingBody.module.scss';

interface StepEditorProps {
  /** Uses languageCode. */
  selectedTranslation?: LanguageCode;
  onRequestSelectTranslation: (
    newSelectedOption: LanguageCode | undefined
  ) => void;
}

export default function StepEditor(props: StepEditorProps) {
  function discardDraft() {
    singleProcessingStore.safelyDeleteTranslationDraft();
  }

  function saveDraft() {
    const draft = singleProcessingStore.getTranslationDraft();

    if (draft?.languageCode !== undefined && draft?.value !== undefined) {
      singleProcessingStore.setTranslation(draft.languageCode, draft.value);
    }
  }

  /** Changes the draft value, preserving the other draft properties. */
  function setDraftValue(newVal: string | undefined) {
    const newDraft =
      clonedeep(singleProcessingStore.getTranslationDraft()) || {};
    newDraft.value = newVal;
    singleProcessingStore.setTranslationDraft(newDraft);
  }

  const draft = singleProcessingStore.getTranslationDraft();

  // The discard button will become a back button when there are no unsaved changes.
  let discardLabel = t('Back');
  if (singleProcessingStore.hasUnsavedTranslationDraftValue()) {
    discardLabel = t('Discard');
  }

  return (
    <div className={bodyStyles.root}>
      <header className={bodyStyles.transxHeader}>
        <HeaderLanguageAndDate
          selectedTranslation={props.selectedTranslation}
          onRequestSelectTranslation={props.onRequestSelectTranslation}
        />

        <div className={bodyStyles.transxHeaderButtons}>
          <Button
            type='secondary'
            size='s'
            label={discardLabel}
            onClick={discardDraft}
            isDisabled={singleProcessingStore.data.isFetchingData}
          />

          <Button
            type='primary'
            size='s'
            label={t('Save')}
            onClick={saveDraft}
            isPending={singleProcessingStore.data.isFetchingData}
            isDisabled={
              !singleProcessingStore.hasUnsavedTranslationDraftValue()
            }
          />
        </div>
      </header>

      <textarea
        className={bodyStyles.textarea}
        value={draft?.value}
        onChange={(evt: React.ChangeEvent<HTMLTextAreaElement>) => {
          setDraftValue(evt.target.value);
        }}
        disabled={singleProcessingStore.data.isFetchingData}
        dir='auto'
      />
    </div>
  );
}
