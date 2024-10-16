import React from 'react';
import alertify from 'alertifyjs';
import {PROJECT_SETTINGS_CONTEXTS, MODAL_TYPES, ASSET_TYPES} from './constants';
import {ROUTES} from 'js/router/routerConstants';
import {dataInterface} from 'js/dataInterface';
import {stores} from './stores';
import assetStore from 'js/assetStore';
import type {AssetStoreData} from 'js/assetStore';
import {actions} from './actions';
import {log, notify, escapeHtml, join} from 'js/utils';
import type {
  AssetResponse,
  CreateImportRequest,
  ImportResponse,
  DeploymentResponse,
} from 'js/dataInterface';
import {getRouteAssetUid} from 'js/router/routerUtils';
import {router, routerGetAssetId, routerIsActive} from 'js/router/legacy';
import {
  archiveAsset,
  unarchiveAsset,
  deleteAsset,
  cloneAssetAsTemplate,
  removeAssetSharing,
  deployAsset,
} from 'js/assetQuickActions';
import type {DropFilesEventHandler} from 'react-dropzone';
import pageState from 'js/pageState.store';

const IMPORT_CHECK_INTERVAL = 1000;

interface ApplyImportParams {
  destination?: string;
  assetUid: string;
  name: string;
  url?: string;
  base64Encoded?: ArrayBuffer | string | null;
  lastModified?: number;
  totalFiles?: number;
}

/*
 * helper function for apply*ToAsset droppable mixin methods
 * returns an interval-driven promise
 */
const applyImport = (params: ApplyImportParams) => {
  const applyPromise = new Promise((resolve, reject) => {
    actions.resources.createImport(params, (data: ImportResponse) => {
      const doneCheckInterval = setInterval(() => {
        dataInterface
          .getImportDetails({
            uid: data.uid,
          })
          .done((importData: ImportResponse) => {
            switch (importData.status) {
              case 'complete': {
                const finalData =
                  importData.messages?.updated || importData.messages?.created;
                if (finalData && finalData.length > 0 && finalData[0].uid) {
                  clearInterval(doneCheckInterval);
                  resolve(finalData[0]);
                } else {
                  clearInterval(doneCheckInterval);
                  reject(importData);
                }
                break;
              }
              case 'processing':
              case 'created': {
                // TODO: notify promise awaiter about delay (after multiple interval rounds)
                break;
              }
              case 'error':
              default: {
                clearInterval(doneCheckInterval);
                reject(importData);
              }
            }
          })
          .fail((failData: ImportResponse) => {
            clearInterval(doneCheckInterval);
            reject(failData);
          });
      }, IMPORT_CHECK_INTERVAL);
    });
  });
  return applyPromise;
};

interface MixinsObject {
  contextRouter: {
    [functionName: string]: Function;
    context?: any;
  };
  droppable: {
    [functionName: string]: Function;
    dropFiles: DropFilesEventHandler;
    context?: any;
    props?: any;
    state?: any;
  };
  dmix: {
    [functionName: string]: Function;
    state?: any;
    props?: any;
  };
}

/**
 * Mixins to be used via react-mixin plugin. These extend components with the
 * methods defined within the given mixin, using the component as `this`.
 *
 * NOTE: please try using mixins as less as possible - when needing a method
 * from here, move it out to separete file (utils?), import here to avoid
 * breaking the code and use the separete file instead of mixin.
 *
 * TODO: think about moving out of mixins, as they are deprecated in new React
 * versions and considered harmful (see
 * https://reactjs.org/blog/2016/07/13/mixins-considered-harmful.html).
 * See: https://github.com/kobotoolbox/kpi/issues/3907
 *
 * @deprecated Use some of the utils functions spread throught many files in
 * the repo (search for files with "utils" in the name). Some of the functions
 * below have direct replacements mentioned.
 */
const mixins: MixinsObject = {
  dmix: {
    afterCopy() {
      notify(t('copied to clipboard'));
    },

    saveCloneAs(versionId?: string) {
      const name = `${t('Clone of')} ${this.state.name}`;

      const dialog = alertify.dialog('prompt');
      const opts = {
        title: `${t('Clone')} ${ASSET_TYPES.survey.label}`,
        message: t(
          'Enter the name of the cloned ##ASSET_TYPE##. Leave empty to keep the original name.'
        ).replace('##ASSET_TYPE##', ASSET_TYPES.survey.label),
        value: name,
        labels: {ok: t('Ok'), cancel: t('Cancel')},
        onok: ({}, value: string) => {
          const uid = this.props.params.assetid || this.props.params.uid;
          actions.resources.cloneAsset(
            {
              uid: uid,
              name: value,
              version_id: versionId,
            },
            {
              onComplete: (asset: AssetResponse) => {
                dialog.destroy();
                router!.navigate(ROUTES.FORM.replace(':uid', asset.uid));
              },
            }
          );

          // keep the dialog open
          return false;
        },
        oncancel: () => {
          dialog.destroy();
        },
      };
      dialog.set(opts).show();
    },

    cloneAsTemplate(evt: React.TouchEvent<HTMLElement>) {
      const sourceUid = evt.currentTarget.dataset.assetUid;
      const sourceName = evt.currentTarget.dataset.assetName;
      if (sourceUid && sourceName) {
        cloneAssetAsTemplate(sourceUid, sourceName);
      }
    },
    deployAsset(asset: AssetResponse) {
      if (!asset || asset.asset_type !== ASSET_TYPES.survey.id) {
        if (this.state && this.state.asset_type === ASSET_TYPES.survey.id) {
          asset = this.state;
        } else {
          console.error(
            'Neither the arguments nor the state supplied an asset.'
          );
          return;
        }
      }
      deployAsset(asset);
    },
    archiveAsset(
      uid: string,
      callback: (response: DeploymentResponse) => void
    ) {
      archiveAsset(uid, callback);
    },
    unarchiveAsset(
      uid: string | null = null,
      callback: (response: DeploymentResponse) => void
    ) {
      if (uid === null) {
        unarchiveAsset(this.state, callback);
      } else {
        unarchiveAsset(uid, callback);
      }
    },
    deleteAsset(
      assetOrUid: AssetResponse | string,
      name: string,
      callback: () => void
    ) {
      deleteAsset(assetOrUid, name, callback);
    },
    toggleDeploymentHistory() {
      this.setState({
        historyExpanded: !this.state.historyExpanded,
      });
    },
    summaryDetails() {
      return (
        <pre>
          <code>
            {this.state.asset_type}
            <br />
            {`[${Object.keys(this.state).join(', ')}]`}
            <br />
            {JSON.stringify(this.state.summary, null, 4)}
          </code>
        </pre>
      );
    },
    asJson() {
      return (
        <pre>
          <code>{JSON.stringify(this.state, null, 4)}</code>
        </pre>
      );
    },
    dmixAssetStoreChange(data: {[uid: string]: AssetResponse}) {
      const uid = this._getAssetUid();
      const asset = data[uid];
      if (asset) {
        this.setState(Object.assign({}, asset));
      }
    },
    _getAssetUid() {
      if (this.props.params) {
        return this.props.params.assetid || this.props.params.uid;
      } else if (this.props.formAsset) {
        // formAsset case is being used strictly for projectSettings component to
        // cause the componentDidMount callback to load the full asset (i.e. one
        // that includes `content`).
        return this.props.formAsset.uid;
      } else {
        return this.props.uid || getRouteAssetUid();
      }
    },
    // TODO 1/2
    // Fix `componentWillUpdate` and `componentDidMount` asset loading flow.
    // Ideally we should build a single overaching component or store that would
    // handle loading of the asset in all necessary cases in a way that all
    // interested parties could use without duplication or confusion and with
    // indication when the loading starts and when ends.
    componentWillUpdate(newProps: any) {
      if (this.props.params?.uid !== newProps.params?.uid) {
        // This case is used by other components (header.es6 is one such component)
        // in a not clear way to gain a data on new asset.
        actions.resources.loadAsset({id: newProps.params.uid});
      }
    },

    componentDidMount() {
      this.dmixAssetStoreCancelListener = assetStore.listen(
        (data: AssetStoreData) => {
          this.dmixAssetStoreChange(data);
        },
        this
      );

      // TODO 2/2
      // HACK FIX: for when we use `PermProtectedRoute`, we don't need to make the
      // call to get asset, as it is being already made. Ideally we want to have
      // this nice SSOT as described in TODO comment above.
      const uid = this._getAssetUid();
      if (uid && this.props.initialAssetLoadNotNeeded) {
        this.setState(Object.assign({}, assetStore.data[uid]));
      } else if (uid) {
        actions.resources.loadAsset({id: uid}, true);
      }
    },

    componentWillUnmount() {
      if (typeof this.dmixAssetStoreCancelListener === 'function') {
        this.dmixAssetStoreCancelListener();
      }
    },

    removeSharing: function () {
      removeAssetSharing(this.props.params.uid);
    },
  },
  /**
   * @deprecated Please refer to `dropzone.utils.tsx` file and update the code
   * there accordingly to your needs. You might end up needing to move and
   * update one of the functions found here.
   */
  droppable: {
    /*
     * returns an interval-driven promise
     */
    applyFileToAsset(file: File, asset: AssetResponse) {
      const applyPromise = new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const params: ApplyImportParams = {
            destination: asset.url,
            assetUid: asset.uid,
            name: file.name,
            base64Encoded: reader.result,
            lastModified: file.lastModified,
            totalFiles: 1,
          };

          applyImport(params).then(
            (data) => {
              resolve(data);
            },
            (data) => {
              reject(data);
            }
          );
        };
        reader.readAsDataURL(file);
      });
      return applyPromise;
    },

    /*
     * returns an interval-driven promise
     */
    applyUrlToAsset(url: string, asset: AssetResponse) {
      const applyPromise = new Promise((resolve, reject) => {
        const params: ApplyImportParams = {
          destination: asset.url,
          url: url,
          name: asset.name,
          assetUid: asset.uid,
        };

        applyImport(params).then(
          (data) => {
            resolve(data);
          },
          (data) => {
            reject(data);
          }
        );
      });
      return applyPromise;
    },

    _forEachDroppedFile(params: CreateImportRequest = {}) {
      const totalFiles = params.totalFiles || 1;

      const isLibrary = routerIsActive(ROUTES.LIBRARY);
      const multipleFiles = params.totalFiles && totalFiles > 1 ? true : false;
      params = Object.assign({library: isLibrary}, params);

      if (params.base64Encoded) {
        pageState.showModal({
          type: MODAL_TYPES.UPLOADING_XLS,
          filename: multipleFiles
            ? t('## files').replace('##', String(totalFiles))
            : params.name,
        });
      }

      delete params.totalFiles;

      if (!isLibrary && params.base64Encoded) {
        const destination = params.destination || this.state.url;
        if (destination) {
          params = Object.assign({destination: destination}, params);
        }
      }

      actions.resources.createImport(
        params,
        (data: ImportResponse) => {
          // TODO get rid of this barbaric method of waiting a magic number of seconds
          // to check if import was done - possibly while doing
          // https://github.com/kobotoolbox/kpi/issues/476
          window.setTimeout(() => {
            dataInterface
              .getImportDetails({
                uid: data.uid,
              })
              .done((importData: ImportResponse) => {
                if (importData.status === 'complete') {
                  const assetData =
                    importData.messages?.updated ||
                    importData.messages?.created;
                  const assetUid =
                    assetData && assetData.length > 0 && assetData[0].uid;
                  if (!isLibrary && multipleFiles) {
                    this.searchDefault();
                    // No message shown for multiple files when successful, to avoid overloading screen
                  } else if (!assetUid) {
                    // TODO: use a more specific error message here
                    notify.error(
                      t(
                        'XLSForm Import failed. Check that the XLSForm and/or the URL are valid, and try again using the "Replace form" icon.'
                      )
                    );
                    if (params.assetUid) {
                      router!.navigate(
                        ROUTES.FORM.replace(':uid', params.assetUid)
                      );
                    }
                  } else {
                    if (
                      this.props.context ===
                        PROJECT_SETTINGS_CONTEXTS.REPLACE &&
                      routerIsActive(ROUTES.FORMS)
                    ) {
                      actions.resources.loadAsset({id: assetUid});
                    } else if (!isLibrary) {
                      router!.navigate(ROUTES.FORM.replace(':uid', assetUid));
                    }
                    notify(t('XLS Import completed'));
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
            pageState.hideModal();
          }, 2500);
        },
        (jqxhr: string) => {
          log('Failed to create import: ', jqxhr);
          notify.error(t('Failed to create import.'));
        }
      );
    },

    dropFiles(files: File[], rejectedFiles: File[], {}, pms = {}) {
      files.map((file) => {
        const reader = new FileReader();
        reader.onload = () => {
          const params = Object.assign(
            {
              name: file.name,
              base64Encoded: reader.result,
              lastModified: file.lastModified,
              totalFiles: files.length,
            },
            pms
          );

          this._forEachDroppedFile(params);
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
    },
  },
  /**
   * @deprecated Use `routerUtils.ts` instead.
   */
  contextRouter: {
    isFormList() {
      return (
        routerIsActive(ROUTES.FORMS) && this.currentAssetID() === undefined
      );
    },
    isLibrary() {
      return routerIsActive(ROUTES.LIBRARY);
    },
    isMyLibrary() {
      return routerIsActive(ROUTES.MY_LIBRARY);
    },
    isPublicCollections() {
      return routerIsActive(ROUTES.PUBLIC_COLLECTIONS);
    },
    isLibrarySingle() {
      return (
        routerIsActive(ROUTES.LIBRARY) && this.currentAssetID() !== undefined
      );
    },
    isFormSingle() {
      return (
        routerIsActive(ROUTES.FORMS) && this.currentAssetID() !== undefined
      );
    },
    currentAssetID() {
      return routerGetAssetId();
    },
    currentAsset() {
      return assetStore.data[this.currentAssetID()];
    },
    isActiveRoute(path: string) {
      return routerIsActive(path);
    },
    isFormBuilder() {
      if (routerIsActive(ROUTES.NEW_LIBRARY_ITEM)) {
        return true;
      }

      const uid = this.currentAssetID();
      return (
        (uid !== undefined &&
          routerIsActive(ROUTES.EDIT_LIBRARY_ITEM.replace(':uid', uid))) ||
        routerIsActive(ROUTES.NEW_LIBRARY_ITEM.replace(':uid', uid)) ||
        routerIsActive(ROUTES.FORM_EDIT.replace(':uid', uid))
      );
    },
  },
};

export default mixins;
