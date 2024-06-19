import React from 'react';
import type {FileWithPreview} from 'react-dropzone';
import type {CreateImportRequest, ImportResponse} from 'js/dataInterface';
import {dataInterface} from 'js/dataInterface';
import {escapeHtml, join, log, notify, getExponentialDelayTime} from 'js/utils';
import {MODAL_TYPES} from './constants';
import {router, routerIsActive} from 'js/router/legacy';
import {ROUTES} from './router/routerConstants';
import envStore from './envStore'
import pageState from 'js/pageState.store';

const IMPORT_FAILED_GENERIC_MESSAGE = t('Import failed');

/**
 * An internal method for handling a single file import. Its main functionality
 * is creating new asset as either a project or a library item.
 *
 * It uses a promise to get the final status of the import (either "complete" or
 * "error"). It waits for the import finish using an exponential interval.
 */
function onImportSingleXLSFormFile(
  name: string,
  base64Encoded: string | ArrayBuffer | null
) {
  const isLibrary = routerIsActive(ROUTES.LIBRARY);

  const importPromise = new Promise<ImportResponse>((resolve, reject) => {
    if (!base64Encoded) {
      reject(IMPORT_FAILED_GENERIC_MESSAGE);
      return;
    }

    dataInterface
      .createImport({
        name: name,
        base64Encoded: base64Encoded,
        library: isLibrary,
      })
      .done((data: ImportResponse) => {
        // After import was created successfully, we start a loop of checking
        // the status of it (by calling API). The promise will resolve when it is
        // complete.
        notify(
          t('Your upload is being processed. This may take a few moments.')
        );

        let callCount = 0;
        let timeoutId = -1;

        function makeIntervalStatusCheck() {
          // Make the first call only after we've already waited once. This
          // ensures we don't check for the import status immediately after it
          // was created.
          if (timeoutId > 0) {
            dataInterface
              .getImportDetails({uid: data.uid})
              .done((importData: ImportResponse) => {
                if (importData.status === 'complete') {
                  // Stop interval
                  window.clearTimeout(timeoutId);

                  resolve(importData);
                } else if (
                  importData.status === 'processing' &&
                  callCount === 5
                ) {
                  notify.warning(
                    t(
                      'Your upload is taking longer than usual. Please get back in few minutes.'
                    )
                  );
                } else if (importData.status === 'error') {
                  // Stop interval
                  window.clearTimeout(timeoutId);

                  // Gather all useful error information
                  const errLines = [];
                  errLines.push(t('Import Failed!'));
                  if (name) {
                    errLines.push(<code>Name: {name}</code>);
                  }
                  if (importData.messages?.error) {
                    errLines.push(
                      <code>
                        ${importData.messages.error_type}: $
                        {escapeHtml(importData.messages.error)}
                      </code>
                    );
                  }
                  reject(<div>{join(errLines, <br />)}</div>);
                }
              })
              .fail(() => {
                // Stop interval
                window.clearTimeout(timeoutId);

                reject(IMPORT_FAILED_GENERIC_MESSAGE);
              });
          }

          callCount += 1;

          // Keep the interval alive (can't use `setInterval` with randomized
          // value, so we use `setTimout` instead).
          timeoutId = window.setTimeout(
            makeIntervalStatusCheck,
            getExponentialDelayTime(
              callCount,
              envStore.data.min_retry_time,
              envStore.data.max_retry_time
            )
          );
        }

        // start the interval check
        makeIntervalStatusCheck();
      })
      .fail(() => {
        reject(t('Failed to create import.'));
      });
  });

  // Handle import processing finish scenarios
  importPromise.then(
    (importData: ImportResponse) => {
      notify(t('XLS Import completed'));

      // We navigate into the imported Project when import completes (not in
      // Library though)
      if (!isLibrary && importData.messages?.created) {
        // We have to dig deep for that single asset uid :)
        const firstCreated = importData.messages.created[0];
        if (firstCreated?.uid) {
          router!.navigate(ROUTES.FORM.replace(':uid', firstCreated.uid));
        }
      }
    },
    (reason: string) => {
      notify.error(reason);
    }
  );
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
  totalFilesInBatch: number
) {
  const isLibrary = routerIsActive(ROUTES.LIBRARY);
  const isLastFileInBatch = fileIndex + 1 === totalFilesInBatch;

  // We open the modal that displays the message with total files count.
  pageState.showModal({
    type: MODAL_TYPES.UPLOADING_XLS,
    filename: t('## files').replace('##', String(totalFilesInBatch)),
  });

  const params: CreateImportRequest = {
    name: name,
    base64Encoded: base64Encoded,
    totalFiles: totalFilesInBatch,
    library: isLibrary,
  };

  dataInterface
    .createImport(params)
    // we purposefuly don't do anything on `.done` here
    .fail((jqxhr: string) => {
      log('Failed to create import: ', jqxhr);
      notify.error(t('Failed to create import.'));
    })
    .always(() => {
      // We run this when last file in the batch finishes. Note that this
      // doesn't mean that this is last import that finished, as they are being
      // run asynchronously. It's not perfect, but we don't care (rough around
      // the edges).
      if (isLastFileInBatch) {
        // After the last import is created, we hide the modal…
        pageState.hideModal();
        // …and display a helpful toast
        notify.warning(
          t(
            'Your uploads are being processed. This may take a few moments. You will need to refresh the page to see them on the list.'
          )
        );
      }
    });
}

/**
 * This is a callback function for `Dropzone` component that handles uploading
 * multiple XLSForm files.
 *
 * Note: similar function is available in `mixins.droppable.dropFiles`, but it
 * relies heavily on deprecated technologies.
 */
export function dropImportXLSForms(
  accepted: FileWithPreview[],
  rejected: FileWithPreview[]
) {
  accepted.map((file, index) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (accepted.length === 1) {
        onImportSingleXLSFormFile(file.name, reader.result);
      } else {
        onImportOneAmongMany(file.name, reader.result, index, accepted.length);
      }
    };
    reader.readAsDataURL(file);
  });

  rejected.every((file) => {
    if (file.type && file.name) {
      let errMsg = t('Upload error: could not recognize Excel file.');
      errMsg += ` (${t('Uploaded file name: ')} ${file.name})`;
      notify.error(errMsg);
      return true;
    } else {
      notify.error(t('Could not recognize the dropped item(s).'));
      return false;
    }
  });
}
