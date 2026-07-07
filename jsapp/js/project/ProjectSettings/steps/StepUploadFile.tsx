import React from 'react'
import DropzoneNew from '#/components/common/DropzoneNew'
import LoadingSpinner from '#/components/common/loadingSpinner'
import { validFileTypes } from '#/utils'
import styles from '../ProjectSettings.module.scss'
import BackButton from '../components/BackButton'
import type { StepName } from '../constants'

interface StepUploadFileProps {
  isUploadFilePending: boolean
  onFileDrop: (files: File[]) => void
  previousStep: StepName | null
  onBack: () => void
  modalStyle: string | null
}

export default function StepUploadFile({
  isUploadFilePending,
  onFileDrop,
  previousStep,
  onBack,
  modalStyle,
}: StepUploadFileProps) {
  return (
    <form className={modalStyle || undefined}>
      <div className={styles.modalSubheader}>{t('Import an XLSForm from your computer.')}</div>

      {!isUploadFilePending && (
        <DropzoneNew
          onDrop={onFileDrop}
          multiple={false}
          maxFiles={1}
          accept={validFileTypes()}
          className='kobo-dropzone'
        >
          <DropzoneNew.Accept>
            <i className='k-icon k-icon-file-xls' />
            {t(' Drag and drop the XLSForm file here or click to browse')}
          </DropzoneNew.Accept>
          <DropzoneNew.Reject>
            <i className='k-icon k-icon-file-xls' />
            {t(' Only XLSForm files are supported')}
          </DropzoneNew.Reject>
          <DropzoneNew.Idle>
            <i className='k-icon k-icon-file-xls' />
            {t(' Drag and drop the XLSForm file here or click to browse')}
          </DropzoneNew.Idle>
        </DropzoneNew>
      )}
      {isUploadFilePending && (
        <div className='dropzone'>
          <LoadingSpinner message={t('Uploading file…')} />
        </div>
      )}

      <footer className={styles.modalFooter}>
        <BackButton previousStep={previousStep} isDisabled={isUploadFilePending} onClick={onBack} />
      </footer>
    </form>
  )
}
