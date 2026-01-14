import React from 'react'

import clonedeep from 'lodash.clonedeep'
import type { _DataSupplementResponseOneOfOneOfManualTranscriptionVersionsItem } from '#/api/models/_dataSupplementResponseOneOfOneOfManualTranscriptionVersionsItem'
import assetStore from '#/assetStore'
import Button from '#/components/common/button'
import { userCan } from '#/components/permissions/utils'
import singleProcessingStore from '#/components/processing/singleProcessingStore'
import bodyStyles from '../../common/processingBody.module.scss'
import HeaderLanguageAndDate from './headerLanguageAndDate'

interface Props {
  draft: _DataSupplementResponseOneOfOneOfManualTranscriptionVersionsItem
  assetUid: string
}

export default function StepEditor({
  assetUid,
  draft,
}: Props) {
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
            isDisabled={
              singleProcessingStore.data.isFetchingData || !userCan('change_submissions', assetStore.getAsset(assetUid))
            }
          />

          <Button
            type='primary'
            size='s'
            label={t('Save')}
            onClick={saveDraft}
            isPending={singleProcessingStore.data.isFetchingData}
            isDisabled={
              !singleProcessingStore.hasUnsavedTranscriptDraftValue() ||
              !userCan('change_submissions', assetStore.getAsset(assetUid))
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
