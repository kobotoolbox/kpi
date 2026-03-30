import styles from './dataImportModal.module.scss'

import React, { useCallback, useRef, useState } from 'react'

import Button from '#/components/common/button'
import Checkbox from '#/components/common/checkbox'
import KoboModal from '#/components/modals/koboModal'
import KoboModalContent from '#/components/modals/koboModalContent'
import KoboModalFooter from '#/components/modals/koboModalFooter'
import KoboModalHeader from '#/components/modals/koboModalHeader'
import { dataInterface } from '#/dataInterface'
import type { AssetResponse } from '#/dataInterface'
import envStore from '#/envStore'
import { getExponentialDelayTime } from '#/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ModalPhase = 'idle' | 'uploading' | 'success' | 'error'

interface SubmissionImportTaskResponse {
  uid?: string
  status?: 'created' | 'processing' | 'complete' | 'error'
  messages?: {
    detail?: string
    error?: string
    error_type?: string
    rows_imported?: number
  }
}

interface DataImportModalProps {
  asset: AssetResponse
  isOpen: boolean
  onClose: () => void
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ACCEPTED_FILE_TYPES = '.xls,.xlsx'

/**
 * Placeholder — replace with the real support article URL once it exists.
 * The link explains: (1) column headers must match field names, and
 * (2) how to download an Excel template for the project.
 */
const SUPPORT_ARTICLE_URL = 'https://support.kobotoolbox.org/howto_import_data.html'

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Modal for importing submission data from an Excel (XLS/XLSX) file.
 *
 * Flow:
 *  idle       → user picks a file and acknowledges the validation disclaimer
 *  uploading  → XHR with progress bar; switches to polling if async task returned
 *  success    → shows row count and a Close button
 *  error      → shows human-readable message with Try Again / Close buttons
 */
export default function DataImportModal({ asset, isOpen, onClose }: DataImportModalProps) {
  const [phase, setPhase] = useState<ModalPhase>('idle')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [disclaimerChecked, setDisclaimerChecked] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [rowsImported, setRowsImported] = useState<number | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const pollingTimeoutRef = useRef<number>(-1)
  const xhrRef = useRef<XMLHttpRequest | null>(null)

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  const resetState = useCallback(() => {
    if (pollingTimeoutRef.current > 0) {
      window.clearTimeout(pollingTimeoutRef.current)
      pollingTimeoutRef.current = -1
    }
    if (xhrRef.current) {
      xhrRef.current.abort()
      xhrRef.current = null
    }
    setPhase('idle')
    setSelectedFile(null)
    setDisclaimerChecked(false)
    setUploadProgress(0)
    setRowsImported(null)
    setErrorMessage(null)
    // Clear the file input so the same file can be re-selected after a retry
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [])

  const handleClose = useCallback(() => {
    resetState()
    onClose()
  }, [resetState, onClose])

  const handleRetry = useCallback(() => {
    setPhase('idle')
    setErrorMessage(null)
    setUploadProgress(0)
  }, [])

  // -------------------------------------------------------------------------
  // File selection
  // -------------------------------------------------------------------------

  const handleFileChange = (evt: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedFile(evt.target.files?.[0] ?? null)
  }

  // -------------------------------------------------------------------------
  // Polling
  // -------------------------------------------------------------------------

  const pollTaskStatus = useCallback(
    (taskUid: string, callCount = 0) => {
      pollingTimeoutRef.current = window.setTimeout(() => {
        dataInterface
          .getSubmissionImportStatus(asset.uid, taskUid)
          .done((data: SubmissionImportTaskResponse) => {
            if (data.status === 'complete') {
              setRowsImported(data.messages?.rows_imported ?? null)
              setPhase('success')
            } else if (data.status === 'error') {
              setErrorMessage(
                data.messages?.detail ||
                  data.messages?.error ||
                  t('Import failed. Please check your file and try again.'),
              )
              setPhase('error')
            } else {
              // Still processing — keep polling with exponential back-off
              pollTaskStatus(taskUid, callCount + 1)
            }
          })
          .fail(() => {
            setErrorMessage(t('Failed to check import status. Please refresh the page.'))
            setPhase('error')
          })
      }, getExponentialDelayTime(callCount, envStore.data.min_retry_time, envStore.data.max_retry_time))
    },
    [asset.uid],
  )

  // -------------------------------------------------------------------------
  // Upload
  // -------------------------------------------------------------------------

  const handleUpload = useCallback(() => {
    if (!selectedFile) return

    setPhase('uploading')
    setUploadProgress(0)

    const formData = new FormData()
    formData.append('file', selectedFile)

    const xhr = new XMLHttpRequest()
    xhrRef.current = xhr

    xhr.upload.onprogress = (evt) => {
      if (evt.lengthComputable) {
        // Cap at 95% during upload — the remaining 5% resolves when the
        // server response arrives (or polling completes).
        setUploadProgress(Math.min(Math.round((evt.loaded / evt.total) * 100), 95))
      }
    }

    xhr.onload = () => {
      xhrRef.current = null

      if (xhr.status >= 200 && xhr.status < 300) {
        setUploadProgress(100)
        let response: SubmissionImportTaskResponse = {}
        try {
          response = JSON.parse(xhr.responseText)
        } catch {
          // Non-JSON success response — treat as immediate completion
        }

        if (response.uid && response.status !== 'complete') {
          // Async task queued — start polling
          pollTaskStatus(response.uid)
        } else {
          setRowsImported(response.messages?.rows_imported ?? null)
          setPhase('success')
        }
      } else {
        let message = t('Upload failed. Please try again.')
        try {
          const errData = JSON.parse(xhr.responseText)
          if (errData?.detail) message = errData.detail
          else if (errData?.error) message = errData.error
          else if (typeof errData === 'string') message = errData
        } catch {
          // ignore JSON parse error — keep the generic message
        }
        setErrorMessage(message)
        setPhase('error')
      }
    }

    xhr.onerror = () => {
      xhrRef.current = null
      setErrorMessage(t('A network error occurred. Please check your connection and try again.'))
      setPhase('error')
    }

    xhr.onabort = () => {
      xhrRef.current = null
    }

    // Read CSRF token from cookie (Django requirement)
    const csrfMatch = document.cookie.match(/csrftoken=([^;]+)/)
    const csrfToken = csrfMatch ? csrfMatch[1] : ''

    xhr.open('POST', dataInterface.getSubmissionImportUrl(asset.uid))
    xhr.setRequestHeader('X-CSRFToken', csrfToken)
    xhr.send(formData)
  }, [selectedFile, asset.uid, pollTaskStatus])

  // -------------------------------------------------------------------------
  // Render helpers
  // -------------------------------------------------------------------------

  const canUpload = selectedFile !== null && disclaimerChecked

  function renderIdleContent() {
    return (
      <>
        <div className={styles.helpBlock}>
          <p>
            {t(
              'Column headers in your spreadsheet must match the field names in this form. ' +
                'You can also download a template with the correct headers.',
            )}
          </p>
          <a href={SUPPORT_ARTICLE_URL} target='_blank' rel='noopener noreferrer'>
            {t('Learn more and download a template')}
          </a>
        </div>

        <div className={styles.fileRow}>
          <Button
            type='secondary'
            size='m'
            startIcon='file-xls'
            label={t('Choose file…')}
            onClick={() => fileInputRef.current?.click()}
          />
          {selectedFile && <span className={styles.fileName}>{selectedFile.name}</span>}
          <input
            ref={fileInputRef}
            type='file'
            accept={ACCEPTED_FILE_TYPES}
            className={styles.hiddenInput}
            onChange={handleFileChange}
          />
        </div>

        <div className={styles.disclaimer}>
          <Checkbox
            checked={disclaimerChecked}
            onChange={setDisclaimerChecked}
            label={t(
              'I understand that importing data bypasses form validation ' +
                'and may introduce data inconsistencies.',
            )}
          />
        </div>
      </>
    )
  }

  function renderUploadingContent() {
    return (
      <div className={styles.progressBlock}>
        <p>{uploadProgress < 100 ? t('Uploading…') : t('Processing…')}</p>
        <progress value={uploadProgress} max={100} className={styles.progressBar} />
        <span className={styles.progressLabel}>{uploadProgress}%</span>
      </div>
    )
  }

  function renderSuccessContent() {
    return (
      <div className={styles.resultBlock}>
        <p>
          {rowsImported !== null
            ? t('Upload complete. ##COUNT## rows were imported.').replace(
                '##COUNT##',
                String(rowsImported),
              )
            : t('Upload completed successfully.')}
        </p>
      </div>
    )
  }

  function renderErrorContent() {
    return (
      <div className={styles.resultBlock}>
        <p className={styles.errorText}>{errorMessage}</p>
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <KoboModal isOpen={isOpen} onRequestClose={handleClose} size='medium'>
      <KoboModalHeader icon='upload' iconColor='grey' onRequestCloseByX={handleClose}>
        {t('Import data')}
      </KoboModalHeader>

      <KoboModalContent>
        {phase === 'idle' && renderIdleContent()}
        {phase === 'uploading' && renderUploadingContent()}
        {phase === 'success' && renderSuccessContent()}
        {phase === 'error' && renderErrorContent()}
      </KoboModalContent>

      <KoboModalFooter>
        {phase === 'idle' && (
          <>
            <Button type='secondary' size='m' label={t('Cancel')} onClick={handleClose} />
            <Button
              type='primary'
              size='m'
              startIcon='upload'
              label={t('Upload')}
              isDisabled={!canUpload}
              onClick={handleUpload}
            />
          </>
        )}

        {phase === 'uploading' && (
          // Keep Cancel visible but disabled so layout doesn't jump
          <Button type='secondary' size='m' label={t('Cancel')} isDisabled />
        )}

        {phase === 'success' && (
          <Button type='primary' size='m' label={t('Close')} onClick={handleClose} />
        )}

        {phase === 'error' && (
          <>
            <Button type='secondary' size='m' label={t('Try again')} onClick={handleRetry} />
            <Button type='primary' size='m' label={t('Close')} onClick={handleClose} />
          </>
        )}
      </KoboModalFooter>
    </KoboModal>
  )
}
