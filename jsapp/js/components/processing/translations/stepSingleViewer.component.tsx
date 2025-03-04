import React from 'react'

import { destroyConfirm } from '#/alertify'
import Button from '#/components/common/button'
import type { LanguageCode } from '#/components/languages/languagesStore'
import bodyStyles from '#/components/processing/processingBody.module.scss'
import singleProcessingStore from '#/components/processing/singleProcessingStore'
import { hasManagePermissionsToCurrentAsset } from '../analysis/utils'
import HeaderLanguageAndDate from './headerLanguageAndDate.component'
import styles from './stepSingleViewer.module.scss'

interface StepSingleViewerProps {
  /** Uses languageCode. */
  selectedTranslation?: LanguageCode
  onRequestSelectTranslation: (newSelectedOption: LanguageCode | undefined) => void
}

export default function StepSingleViewer(props: StepSingleViewerProps) {
  function addTranslation() {
    // Make an empty draft to make the language selector appear. Unselect
    // the current translation.
    singleProcessingStore.setTranslationDraft({})
  }

  function openEditor() {
    const translation = singleProcessingStore.getTranslation(props.selectedTranslation)
    if (translation) {
      // Make new draft using existing translation.
      singleProcessingStore.setTranslationDraft(translation)
      props.onRequestSelectTranslation(props.selectedTranslation)
    }
  }

  function deleteTranslation() {
    if (props.selectedTranslation) {
      destroyConfirm(
        singleProcessingStore.deleteTranslation.bind(singleProcessingStore, props.selectedTranslation),
        t('Delete translation?'),
      )
    }
  }

  if (!props.selectedTranslation) {
    return null
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
            startIcon='plus'
            label={
              <>
                <span className={styles.newButtonLabel}>{t('new translation')}</span>
                <span className={styles.newButtonLabelShort}>{t('new')}</span>
              </>
            }
            onClick={addTranslation}
            isDisabled={singleProcessingStore.data.isFetchingData || !hasManagePermissionsToCurrentAsset()}
          />

          <Button
            type='secondary'
            size='s'
            startIcon='edit'
            onClick={openEditor}
            tooltip={t('Edit')}
            isDisabled={singleProcessingStore.data.isFetchingData || !hasManagePermissionsToCurrentAsset()}
          />

          <Button
            type='secondary-danger'
            size='s'
            startIcon='trash'
            onClick={deleteTranslation}
            tooltip={t('Delete')}
            isPending={singleProcessingStore.data.isFetchingData}
            isDisabled={!hasManagePermissionsToCurrentAsset()}
          />
        </div>
      </header>

      <article className={bodyStyles.text} dir='auto'>
        {singleProcessingStore.getTranslation(props.selectedTranslation)?.value}
      </article>
    </div>
  )
}
