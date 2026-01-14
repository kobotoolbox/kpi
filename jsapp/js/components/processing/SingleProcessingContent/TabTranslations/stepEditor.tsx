import React from 'react'

import clonedeep from 'lodash.clonedeep'
import assetStore from '#/assetStore'
import Button from '#/components/common/button'
import type { LanguageCode } from '#/components/languages/languagesStore'
import { userCan } from '#/components/permissions/utils'
import bodyStyles from '../../common/processingBody.module.scss'
import singleProcessingStore from '../../singleProcessingStore'
import HeaderLanguageAndDate from './headerLanguageAndDate'

interface Props {
  assetUid: string
  /** Uses languageCode. */
  selectedTranslation?: LanguageCode
  onRequestSelectTranslation: (newSelectedOption: LanguageCode | undefined) => void
}

export default function StepEditor(props: Props) {
  function discardDraft() {
    singleProcessingStore.safelyDeleteTranslationDraft()
  }

  function saveDraft() {
    const draft = singleProcessingStore.getTranslationDraft()

    if (draft?.languageCode !== undefined && draft?.value !== undefined) {
      singleProcessingStore.setTranslation(draft.languageCode, draft.value)
    }
  }

  /** Changes the draft value, preserving the other draft properties. */
  function setDraftValue(newVal: string | undefined) {
    const newDraft = clonedeep(singleProcessingStore.getTranslationDraft()) || {}
    newDraft.value = newVal
    singleProcessingStore.setTranslationDraft(newDraft)
  }

  const draft = singleProcessingStore.getTranslationDraft()

  // The discard button will become a back button when there are no unsaved changes.
  let discardLabel = t('Back')
  if (singleProcessingStore.hasUnsavedTranslationDraftValue()) {
    discardLabel = t('Discard')
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
            isDisabled={
              singleProcessingStore.data.isFetchingData || !userCan('change_submissions', assetStore.getAsset(props.assetUid))
            }
          />

          <Button
            type='primary'
            size='s'
            label={t('Save')}
            onClick={saveDraft}
            isPending={singleProcessingStore.data.isFetchingData}
            isDisabled={
              !singleProcessingStore.hasUnsavedTranslationDraftValue() ||
              !userCan('change_submissions', assetStore.getAsset(props.assetUid))
            }
          />
        </div>
      </header>

      <textarea
        className={bodyStyles.textarea}
        value={draft?.value}
        onChange={(evt: React.ChangeEvent<HTMLTextAreaElement>) => {
          setDraftValue(evt.target.value)
        }}
        disabled={singleProcessingStore.data.isFetchingData}
        dir='auto'
      />
    </div>
  )
}
