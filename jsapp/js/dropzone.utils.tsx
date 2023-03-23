import React from 'react';
import type {FileWithPreview} from 'react-dropzone';
import type {CreateImportRequest, ImportResponse} from 'js/dataInterface';
import {dataInterface} from 'js/dataInterface';
import {history} from './router/historyRouter';
import {log, notify, escapeHtml, join} from 'js/utils';
import {MODAL_TYPES} from './constants';
import {routerIsActive} from 'js/router/legacy';
import {ROUTES} from './router/routerConstants';
import {stores} from './stores';

/** The amount of time to wait before checking if import is complete. */
const IMPORT_STATUS_CHECK_TIMEOUT = 2500;

/**
 * An internal method for handling a single file import. Its only functionality
 * is adding new asset (no replacing, no cloning as different type, etc.) as
 * either a project or a library item.
 */
function onImportXLSFormFile(
  name: string,
  base64Encoded: string | ArrayBuffer | null,
  totalFilesInBatch = 1,
  destination?: string
) {
  const isLibrary = routerIsActive('library');

  if (base64Encoded) {
    stores.pageState.showModal({
      type: MODAL_TYPES.UPLOADING_XLS,
      filename:
        totalFilesInBatch > 1
          ? t('## files').replace('##', String(totalFilesInBatch))
          : name,
    });
  }

  const params: CreateImportRequest = {
    name: name,
    base64Encoded: base64Encoded,
    totalFiles: totalFilesInBatch,
    library: isLibrary,
  };

  // We can't send `destination: undefined` as it causes the API call to fail
  if (destination) {
    params.destination = destination;
  }

  dataInterface
    .createImport(params)
    .done((data: ImportResponse) => {
      // TODO get rid of this barbaric method of waiting a magic number of
      // seconds to check if import was done - possibly while doing
      // https://github.com/kobotoolbox/kpi/issues/476
      window.setTimeout(() => {
        dataInterface
          .getImportDetails({
            uid: data.uid,
          })
          .done((importData: ImportResponse) => {
            if (importData.status === 'complete') {
              // TODO: ideally we would like to notify interested components about
              // the import success, so they could act accordingly (e.g. relaoding
              // the list of assets, navigating to freshly imported asset etc.).

              notify(t('XLS Import completed'));

              // If user was importing only a single file, we want to navigate
              // into its Project when import completes (not in Library though)
              if (
                totalFilesInBatch === 1 &&
                !isLibrary &&
                importData.messages?.created
              ) {
                // We have to dig deep for that single asset uid :)
                const firstCreated = importData.messages.created[0];
                if (firstCreated?.uid) {
                  history.push(ROUTES.FORM.replace(':uid', firstCreated.uid));
                }
              }
            } else if (importData.status === 'processing') {
              // If the import task didn't complete immediately, inform the user accordingly.
              notify.warning(
                t(
                  'Your upload is being processed. This may take a few moments.'
                )
              );
            } else if (importData.status === 'created') {
              notify.warning(
                t(
                  'Your upload is queued for processing. This may take a few moments.'
                )
              );
            } else if (importData.status === 'error') {
              const errLines = [];
              errLines.push(t('Import Failed!'));
              if (params.name) {
                errLines.push(<code>Name: {params.name}</code>);
              }
              if (importData.messages?.error) {
                errLines.push(
                  <code>
                    ${importData.messages.error_type}: $
                    {escapeHtml(importData.messages.error)}
                  </code>
                );
              }
              notify.error(<div>{join(errLines, <br />)}</div>);
            } else {
              notify.error(t('Import Failed!'));
            }
          })
          .fail((failData: ImportResponse) => {
            notify.error(t('Import Failed!'));
            log('import failed', failData);
          });
        stores.pageState.hideModal();
      }, IMPORT_STATUS_CHECK_TIMEOUT);
    })
    .fail((jqxhr: string) => {
      log('Failed to create import: ', jqxhr);
      notify.error(t('Failed to create import.'));
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
  acceptedFiles: FileWithPreview[],
  rejectedFiles: FileWithPreview[]
) {
  acceptedFiles.map((file) => {
    const reader = new FileReader();
    reader.onload = () => {
      onImportXLSFormFile(file.name, reader.result, acceptedFiles.length);
    };
    reader.readAsDataURL(file);
  });

  for (let i = 0; i < rejectedFiles.length; i++) {
    if (rejectedFiles[i].type && rejectedFiles[i].name) {
      let errMsg = t('Upload error: could not recognize Excel file.');
      errMsg += ` (${t('Uploaded file name: ')} ${rejectedFiles[i].name})`;
      notify.error(errMsg);
    } else {
      notify.error(t('Could not recognize the dropped item(s).'));
      break;
    }
  }
}
