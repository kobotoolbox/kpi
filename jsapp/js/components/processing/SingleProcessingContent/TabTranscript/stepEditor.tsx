import React from 'react'

import clonedeep from 'lodash.clonedeep'
import type { _DataSupplementResponseOneOfOneOfManualTranscriptionVersionsItem } from '#/api/models/_dataSupplementResponseOneOfOneOfManualTranscriptionVersionsItem'
import Button from '#/components/common/button'
import singleProcessingStore from '#/components/processing/singleProcessingStore'
import bodyStyles from '../../common/processingBody.module.scss'
import { hasChangeSubPermissionToCurrentAsset } from '../TabAnalysis/utils'
import HeaderLanguageAndDate from './headerLanguageAndDate'

export default function StepEditor({
  draft,
}: { draft: _DataSupplementResponseOneOfOneOfManualTranscriptionVersionsItem }) {
  function discardDraft() {
    singleProcessingStore.safelyDeleteTranscriptDraft()
  }

  function saveDraft() {
    const draft = singleProcessingStore.getTranscriptDraft()
    if (draft?.languageCode !== undefined && draft?.value !== undefined) {
      singleProcessingStore.setTranscript(draft.languageCode, draft.value)
    }
  }

  /** Changes the draft value, preserving the other draft properties. */
  function setDraftValue(newVal: string | undefined) {
    const newDraft = clonedeep(singleProcessingStore.getTranscriptDraft()) || {}
    newDraft.value = newVal
    singleProcessingStore.setTranscriptDraft(newDraft)
  }

  // The discard button will become a back button when there are no unsaved changes.
  let discardLabel = t('Back')
  if (singleProcessingStore.hasUnsavedTranscriptDraftValue()) {
    discardLabel = t('Discard')
  }

  return (
    <div className={bodyStyles.root}>
      <header className={bodyStyles.transxHeader}>
        <HeaderLanguageAndDate />

        <nav className={bodyStyles.transxHeaderButtons}>
          <Button
            type='secondary'
            size='s'
            label={discardLabel}
            onClick={discardDraft}
            isDisabled={singleProcessingStore.data.isFetchingData || !hasChangeSubPermissionToCurrentAsset()}
          />

          <Button
            type='primary'
            size='s'
            label={t('Save')}
            onClick={saveDraft}
            isPending={singleProcessingStore.data.isFetchingData}
            isDisabled={
              !singleProcessingStore.hasUnsavedTranscriptDraftValue() || !hasChangeSubPermissionToCurrentAsset()
            }
          />
        </nav>
      </header>

      <textarea
        className={bodyStyles.textarea}
        value={draft?._data.value!}
        onChange={(evt: React.ChangeEvent<HTMLTextAreaElement>) => {
          setDraftValue(evt.target.value)
        }}
        disabled={singleProcessingStore.data.isFetchingData}
        dir='auto'
      />
    </div>
  )
}
