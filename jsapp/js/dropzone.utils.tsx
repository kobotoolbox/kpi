import React from 'react'

import type { FileRejection } from 'react-dropzone'
import { openLibraryUploadModal } from '#/components/library/LibraryUploadModal'
import { MODAL_TYPES } from '#/constants'
import type { AssetResponse, CreateImportRequest, ImportResponse } from '#/dataInterface'
import { dataInterface } from '#/dataInterface'
import { router } from '#/router/legacy'
import { escapeHtml, getExponentialDelayTime, join, log, notify } from '#/utils'
import envStore from './envStore'
import { ROUTES } from './router/routerConstants'
import { isAnyLibraryRoute } from './router/routerUtils'

interface ApplyImportParams {
  destination?: string
  assetUid: string
  name: string
  url?: string
  base64Encoded?: ArrayBuffer | string | null
  lastModified?: number
}

const APPLY_IMPORT_CHECK_INTERVAL = 1000

interface PollImportUntilDoneOptions {
  getDelayMs?: (attempt: number) => number
  onPoll?: (importData: ImportResponse, attempt: number) => void
  waitBeforeFirstCheck?: boolean
}

/**
 * Polls import status until backend reports either `complete` or `error`.
 *
 * Use it after `createImport` succeeds:
 *
 * ```ts
 * pollImportUntilDone(importUid).then(
 *   (importData) => { <handle success> },
 *   (reason) => { <handle failure> },
 * )
 * ```
 */
export function pollImportUntilDone(uid: string, options: PollImportUntilDoneOptions = {}): Promise<ImportResponse> {
  const { getDelayMs, onPoll, waitBeforeFirstCheck = false } = options

  return new Promise((resolve, reject) => {
    let timeoutId: number | undefined
    let attempt = 0

    const scheduleNextCheck = () => {
      const nextAttempt = attempt + 1
      const delayMs = typeof getDelayMs === 'function' ? getDelayMs(nextAttempt) : APPLY_IMPORT_CHECK_INTERVAL
      timeoutId = window.setTimeout(runCheck, delayMs)
    }

    const resolveAndCleanup = (importData: ImportResponse) => {
      if (typeof timeoutId === 'number') {
        window.clearTimeout(timeoutId)
      }
      resolve(importData)
    }

    const rejectAndCleanup = (reason: ImportResponse) => {
      if (typeof timeoutId === 'number') {
        window.clearTimeout(timeoutId)
      }
      reject(reason)
    }

    const runCheck = () => {
      dataInterface
        .getImportDetails({ uid })
        .done((importData: ImportResponse) => {
          attempt += 1
          if (typeof onPoll === 'function') {
            onPoll(importData, attempt)
          }

          switch (importData.status) {
            case 'complete':
              resolveAndCleanup(importData)
              break
            case 'error':
              rejectAndCleanup(importData)
              break
            // 'processing' / 'created' - keep polling
            default:
              scheduleNextCheck()
              break
          }
        })
        .fail((failData: ImportResponse) => {
          rejectAndCleanup(failData)
        })
    }

    if (waitBeforeFirstCheck) {
      scheduleNextCheck()
    } else {
      runCheck()
    }
  })
}

function createImportAndResolveFirstAsset(params: ApplyImportParams): Promise<{ uid: string }> {
  return new Promise((resolve, reject) => {
    dataInterface
      .createImport(params)
      .done((data: ImportResponse) => {
        pollImportUntilDone(data.uid).then(
          (importData) => {
            const finalData = importData.messages?.updated || importData.messages?.created
            if (finalData && finalData.length > 0 && finalData[0].uid) {
              resolve(finalData[0])
            } else {
              reject(importData)
            }
          },
          (err) => reject(err),
        )
      })
      .fail((err: unknown) => reject(err))
  })
}

/**
 * Reads a `File`, uploads it as an import targeting an existing asset (either replacing it or applying it as
 * a destination), and resolves with the first created/updated asset entry once the import completes.
 *
 * Replaces `mixins.droppable.applyFileToAsset`.
 */
export function applyFileToAsset(file: File, asset: AssetResponse): Promise<{ uid: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const params: ApplyImportParams = {
        destination: asset.url,
        assetUid: asset.uid,
        name: file.name,
        base64Encoded: reader.result,
        lastModified: file.lastModified,
      }
      createImportAndResolveFirstAsset(params).then(resolve, reject)
    }
    reader.onerror = () => {
      reject({
        messages: {
          error_type: 'file_read_error',
          error: t('Failed to read file.'),
        },
      })
    }
    reader.readAsDataURL(file)
  })
}

/**
 * Uploads a URL as an import targeting an existing asset, and resolves with
 * the first created/updated asset entry once the import completes.
 *
 * Replaces `mixins.droppable.applyUrlToAsset`.
 */
export function applyUrlToAsset(url: string, asset: AssetResponse): Promise<{ uid: string }> {
  const params: ApplyImportParams = {
    destination: asset.url,
    url,
    name: asset.name,
    assetUid: asset.uid,
  }
  return createImportAndResolveFirstAsset(params)
}

const IMPORT_FAILED_GENERIC_MESSAGE = t('Import failed')

/**
 * An internal method for handling a single file import. Its main functionality
 * is creating new asset as either a project or a library item.
 *
 * It uses a promise to get the final status of the import (either "complete" or
 * "error"). It waits for the import finish using an exponential interval.
 */
function onImportSingleXLSFormFile(name: string, base64Encoded: string | ArrayBuffer | null) {
  const isLibrary = isAnyLibraryRoute()

  const importPromise = new Promise<ImportResponse>((resolve, reject) => {
    if (!base64Encoded) {
      reject(IMPORT_FAILED_GENERIC_MESSAGE)
      return
    }

    dataInterface
      .createImport({
        name: name,
        base64Encoded: base64Encoded,
        library: isLibrary,
      })
      .done((data: ImportResponse) => {
        // After import is created, we poll until complete/error using shared helper.
        notify(t('Your upload is being processed. This may take a few moments.'))

        pollImportUntilDone(data.uid, {
          waitBeforeFirstCheck: true,
          getDelayMs: (attempt) =>
            getExponentialDelayTime(attempt, envStore.data.min_retry_time, envStore.data.max_retry_time),
          onPoll: (importData, attempt) => {
            if (importData.status === 'processing' && attempt === 5) {
              notify.warning(t('Your upload is taking longer than usual. Please check back in a few minutes.'))
            }
          },
        }).then(
          (importData) => {
            resolve(importData)
          },
          (reason: ImportResponse) => {
            if (reason?.status === 'error') {
              const errLines = []
              errLines.push(t('Import Failed!'))
              if (name) {
                errLines.push(<code>Name: {name}</code>)
              }
              if (reason.messages?.error) {
                errLines.push(
                  <code>
                    ${reason.messages.error_type}: ${escapeHtml(reason.messages.error)}
                  </code>,
                )
              }
              reject(<div>{join(errLines, <br />)}</div>)
            } else {
              reject(IMPORT_FAILED_GENERIC_MESSAGE)
            }
          },
        )
      })
      .fail(() => {
        reject(t('Failed to create import.'))
      })
  })

  // Handle import processing finish scenarios
  importPromise.then(
    (importData: ImportResponse) => {
      notify(t('XLS Import completed'))

      // We navigate into the imported Project when import completes (not in
      // Library though)
      if (!isLibrary && importData.messages?.created) {
        // We have to dig deep for that single asset uid :)
        const firstCreated = importData.messages.created[0]
        if (firstCreated?.uid) {
          router!.navigate(ROUTES.FORM.replace(':uid', firstCreated.uid))
        }
      }
    },
    (reason: string) => {
      notify.error(reason)
    },
  )
}

/**
 * An internal method for handling a file import among multiple files being
 * dropped. This one is targeted towards advanced users (as officially we only
 * allow importing a single XLSForm file), thus it is a bit rough around
 * the edges.
 */
function onImportOneAmongMany(
  name: string,
  base64Encoded: string | ArrayBuffer | null,
  fileIndex: number,
  totalFilesInBatch: number,
) {
  const isLibrary = isAnyLibraryRoute()
  const isLastFileInBatch = fileIndex + 1 === totalFilesInBatch

  // We open the modal that displays the message with total files count.
  const uploadProgressModal = openLibraryUploadModal({
    type: MODAL_TYPES.UPLOADING_XLS,
    filename: t('## files').replace('##', String(totalFilesInBatch)),
  })

  const params: CreateImportRequest = {
    name: name,
    base64Encoded: base64Encoded,
    totalFiles: totalFilesInBatch,
    library: isLibrary,
  }

  dataInterface
    .createImport(params)
    // we purposefuly don't do anything on `.done` here
    .fail((jqxhr: string) => {
      log('Failed to create import: ', jqxhr)
      notify.error(t('Failed to create import.'))
    })
    .always(() => {
      // We run this when last file in the batch finishes. Note that this
      // doesn't mean that this is last import that finished, as they are being
      // run asynchronously. It's not perfect, but we don't care (rough around
      // the edges).
      if (isLastFileInBatch) {
        // After the last import is created, we hide the modal…
        uploadProgressModal.close()
        // …and display a helpful toast
        notify.warning(
          t(
            'Your uploads are being processed. This may take a few moments. You will need to refresh the page to see them on the list.',
          ),
        )
      }
    })
}

/**
 * This is a callback function for `Dropzone` component that handles uploading
 * multiple XLSForm files.
 *
 * Note: this implementation supports multi-file XLSForm uploads, but it is
 * intended for advanced use and remains somewhat rough around the edges.
 */
export function dropImportXLSForms(accepted: File[], rejected: FileRejection[]) {
  accepted.map((file, index) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (accepted.length === 1) {
        onImportSingleXLSFormFile(file.name, reader.result)
      } else {
        onImportOneAmongMany(file.name, reader.result, index, accepted.length)
      }
    }
    reader.readAsDataURL(file)
  })

  rejected.every((rejectedFile) => {
    const file = rejectedFile.file
    if (file.type && file.name) {
      let errMsg = t('Upload error: could not recognize Excel file.')
      errMsg += ` (${t('Uploaded file name: ')} ${file.name})`
      notify.error(errMsg)
      return true
    } else {
      notify.error(t('Could not recognize the dropped item(s).'))
      return false
    }
  })
}
