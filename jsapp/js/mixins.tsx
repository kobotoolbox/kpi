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
 */

import React from 'react';
import _ from 'lodash';
import alertify from 'alertifyjs';
import toast from 'react-hot-toast';
import assetUtils from 'js/assetUtils';
import {
  PROJECT_SETTINGS_CONTEXTS,
  MODAL_TYPES,
  ASSET_TYPES,
  ANON_USERNAME,
  PERMISSIONS_CODENAMES,
} from './constants';
import type {PermissionCodename} from 'js/constants';
import {ROUTES} from 'js/router/routerConstants';
import {dataInterface} from 'js/dataInterface';
import {stores} from './stores';
import assetStore from 'js/assetStore';
import sessionStore from 'js/stores/session';
import {actions} from './actions';
import permConfig from 'js/components/permissions/permConfig';
import {
  log,
  assign,
  notify,
  escapeHtml,
  buildUserUrl,
  renderCheckbox,
  join,
} from 'js/utils';
import myLibraryStore from 'js/components/library/myLibraryStore';
import type {
  AssetResponse,
  CreateImportRequest,
  ImportResponse,
  Permission,
  SubmissionResponse,
} from 'js/dataInterface';
import {getRouteAssetUid} from 'js/router/routerUtils';
import { routerGetAssetId, routerIsActive } from './router/legacy';
import { history } from "./router/historyRouter";

const IMPORT_CHECK_INTERVAL = 1000;

interface MixinsObject {
  contextRouter: {
    [functionName: string]: Function;
    context?: any;
  };
  permissions: {
    [functionName: string]: Function;
  };
  clickAssets: {
    onActionButtonClick: Function;
    click: {
      asset: {
        [functionName: string]: Function;
        context?: any;
      };
    };
  };
  droppable: {
    [functionName: string]: Function;
    context?: any;
    props?: any;
    state?: any;
  };
  dmix: {
    [functionName: string]: Function;
    state?: any;
    props?: any;
  };
  cloneAssetAsNewType: {
    dialog: Function;
  };
}

const mixins: MixinsObject = {
  contextRouter: {},
  permissions: {},
  clickAssets: {
    onActionButtonClick: Function.prototype,
    click: {asset: {}},
  },
  droppable: {},
  dmix: {},
  cloneAssetAsNewType: {
    /** Generates dialog when cloning an asset as new type */
    dialog(params: {
      sourceUid: string;
      sourceName: string;
      targetType: string;
      promptTitle: string;
      promptMessage: string;
    }) {
      const dialog = alertify.dialog('prompt');
      const opts = {
        title: params.promptTitle,
        message: params.promptMessage,
        value: _.escape(params.sourceName),
        labels: {ok: t('Create'), cancel: t('Cancel')},
        onok: ({}, value: string) => {
          // disable buttons
          // NOTE: we need to cast it as HTMLElement because of missing innerText in declaration.
          const button1 = (dialog.elements.buttons.primary.children[0] as HTMLElement);
          button1.setAttribute('disabled', 'true');
          button1.innerText = t('Please wait…');
          dialog.elements.buttons.primary.children[1].setAttribute('disabled', 'true');

          actions.resources.cloneAsset({
            uid: params.sourceUid,
            name: value,
            new_asset_type: params.targetType,
          }, {
            onComplete: (asset: AssetResponse) => {
              dialog.destroy();

              switch (asset.asset_type) {
                case ASSET_TYPES.survey.id:
                  history.push(ROUTES.FORM_LANDING.replace(':uid', asset.uid));
                  break;
                case ASSET_TYPES.template.id:
                case ASSET_TYPES.block.id:
                case ASSET_TYPES.question.id:
                  history.push(ROUTES.LIBRARY);
                  break;
              }
            },
            onFailed: () => {
              dialog.destroy();
              notify.error(t('Failed to create new asset!'));
            },
          });

          // keep the dialog open
          return false;
        },
        oncancel: () => {
          dialog.destroy();
        },
      };
      dialog.set(opts).show();
    },
  },
};

mixins.dmix = {
  afterCopy() {
    notify(t('copied to clipboard'));
  },

  saveCloneAs(evt: React.TouchEvent<HTMLElement>) {
    const version_id = evt.currentTarget.dataset.versionId;
    const name = `${t('Clone of')} ${this.state.name}`;

    const dialog = alertify.dialog('prompt');
    const opts = {
      title: `${t('Clone')} ${ASSET_TYPES.survey.label}`,
      message: t('Enter the name of the cloned ##ASSET_TYPE##. Leave empty to keep the original name.').replace('##ASSET_TYPE##', ASSET_TYPES.survey.label),
      value: name,
      labels: {ok: t('Ok'), cancel: t('Cancel')},
      onok: ({}, value: string) => {
        const uid = this.props.params.assetid || this.props.params.uid;
        actions.resources.cloneAsset({
          uid: uid,
          name: value,
          version_id: version_id,
        }, {
          onComplete: (asset: AssetResponse) => {
            dialog.destroy();
            history.push(`/forms/${asset.uid}`);
          },
        });

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
    mixins.cloneAssetAsNewType.dialog({
      sourceUid: sourceUid,
      sourceName: sourceName,
      targetType: ASSET_TYPES.template.id,
      promptTitle: t('Create new template from this project'),
      promptMessage: t('Enter the name of the new template.'),
    });
  },

  _deployAssetFirstTime(asset: AssetResponse) {
    const deployment_toast = notify.warning(t('deploying to kobocat...'), {duration: 60 * 1000});
    actions.resources.deployAsset(asset, false, {
      onDone: () => {
        notify(t('deployed form'));
        actions.resources.loadAsset({id: asset.uid});
        history.push(`/forms/${asset.uid}`);
        toast.dismiss(deployment_toast);
      },
      onFail: () => {
        toast.dismiss(deployment_toast);
      },
    });
  },

  _redeployAsset(asset: AssetResponse) {
    const dialog = alertify.dialog('confirm');
    const opts = {
      title: t('Overwrite existing deployment'),
      // TODO: Split this into two independent translation strings without HTML
      message: t(
        'This form has already been deployed. Are you sure you ' +
        'want overwrite the existing deployment? ' +
        '<br/><br/><strong>This action cannot be undone.</strong>'
      ),
      labels: {ok: t('Ok'), cancel: t('Cancel')},
      onok: () => {
        const ok_button = (dialog.elements.buttons.primary.firstChild as HTMLElement);
        ok_button.setAttribute('disabled', 'true');
        ok_button.innerText = t('Deploying...');
        actions.resources.deployAsset(asset, true, {
          onDone: () => {
            notify(t('redeployed form'));
            actions.resources.loadAsset({id: asset.uid});
            if (dialog && typeof dialog.destroy === 'function') {
              dialog.destroy();
            }
          },
          onFail: () => {
            if (dialog && typeof dialog.destroy === 'function') {
              dialog.destroy();
            }
          },
        });
        // keep the dialog open
        return false;
      },
      oncancel: () => {
        dialog.destroy();
      },
    };
    dialog.set(opts).show();
  },
  deployAsset(asset: AssetResponse) {
    if (!asset || asset.asset_type !== ASSET_TYPES.survey.id) {
        if (this.state && this.state.asset_type === ASSET_TYPES.survey.id) {
          asset = this.state;
        } else {
          console.error('Neither the arguments nor the state supplied an asset.');
          return;
        }
    }
    if (!asset.has_deployment) {
      this._deployAssetFirstTime(asset);
    } else {
      this._redeployAsset(asset);
    }
  },
  archiveAsset(uid: string, callback: Function) {
    mixins.clickAssets.click.asset.archive(uid, callback);
  },
  unarchiveAsset(uid: string | null = null, callback: Function) {
    if (uid === null) {
      mixins.clickAssets.click.asset.unarchive(this.state, callback);
    } else {
      mixins.clickAssets.click.asset.unarchive(uid, callback);
    }
  },
  deleteAsset(assetOrUid: AssetResponse | string, name: string, callback: Function) {
    mixins.clickAssets.click.asset.delete(assetOrUid, name, callback);
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
  asJson(){
    return (
        <pre>
          <code>
            {JSON.stringify(this.state, null, 4)}
          </code>
        </pre>
      );
  },
  dmixAssetStoreChange(data: {[uid: string]: AssetResponse}) {
    const uid = this._getAssetUid();
    const asset = data[uid];
    if (asset) {
      this.setState(assign({}, data[uid]));
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
    if (
      this.props.params?.uid !== newProps.params?.uid
    ) {
      // This case is used by other components (header.es6 is one such component)
      // in a not clear way to gain a data on new asset.
      actions.resources.loadAsset({id: newProps.params.uid});
    }
  },

  componentDidMount() {
    assetStore.listen(this.dmixAssetStoreChange, this);

    // TODO 2/2
    // HACK FIX: for when we use `PermProtectedRoute`, we don't need to make the
    // call to get asset, as it is being already made. Ideally we want to have
    // this nice SSOT as described in TODO comment above.
    const uid = this._getAssetUid();
    if (uid && this.props.initialAssetLoadNotNeeded) {
      this.setState(assign({}, assetStore.data[uid]));
    } else if (uid) {
      actions.resources.loadAsset({id: uid});
    }
  },

  removeSharing: function () {
    mixins.clickAssets.click.asset.removeSharing(this.props.params.uid);
  },
};

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
        dataInterface.getImportDetails({
          uid: data.uid,
        }).done((importData: ImportResponse) => {
          switch (importData.status) {
            case 'complete': {
              const finalData = importData.messages?.updated || importData.messages?.created;
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
        }).fail((failData: ImportResponse) => {
          clearInterval(doneCheckInterval);
          reject(failData);
        });
      }, IMPORT_CHECK_INTERVAL);
    });
  });
  return applyPromise;
};

mixins.droppable = {
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
          (data) => {resolve(data);},
          (data) => {reject(data);}
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
        (data) => {resolve(data);},
        (data) => {reject(data);}
      );
    });
    return applyPromise;
  },

  _forEachDroppedFile(params: CreateImportRequest = {}) {
    const totalFiles = params.totalFiles || 1;

    const router = this.props.router;
    const isProjectReplaceInForm = (
      this.props.context === PROJECT_SETTINGS_CONTEXTS.REPLACE
      && routerIsActive('forms')
      && router.params.uid !== undefined
    );
    const isLibrary = routerIsActive('library');
    const multipleFiles = (params.totalFiles && totalFiles > 1) ? true : false;
    params = assign({library: isLibrary}, params);

    if (params.base64Encoded) {
      stores.pageState.showModal({
        type: MODAL_TYPES.UPLOADING_XLS,
        filename: multipleFiles ? t('## files').replace('##', String(totalFiles)) : params.name,
      });
    }

    delete params.totalFiles;

    if (!isLibrary && params.base64Encoded) {
      const destination = params.destination || this.state.url;
      if (destination) {
        params = assign({destination: destination}, params);
      }
    }

    actions.resources.createImport(params, (data: ImportResponse) => {
      // TODO get rid of this barbaric method of waiting a magic number of seconds
      // to check if import was done - possibly while doing
      // https://github.com/kobotoolbox/kpi/issues/476
      window.setTimeout(() => {
        dataInterface.getImportDetails({
          uid: data.uid,
        }).done((importData: ImportResponse) => {
          if (importData.status === 'complete') {
            const assetData = importData.messages?.updated || importData.messages?.created;
            const assetUid = assetData && assetData.length > 0 && assetData[0].uid;
            if (!isLibrary && multipleFiles) {
              this.searchDefault();
              // No message shown for multiple files when successful, to avoid overloading screen
            } else if (!assetUid) {
              // TODO: use a more specific error message here
              notify.error(t('XLSForm Import failed. Check that the XLSForm and/or the URL are valid, and try again using the "Replace form" icon.'));
              if (params.assetUid) {
                history.push(`/forms/${params.assetUid}`);
              }
            } else {
              if (isProjectReplaceInForm) {
                actions.resources.loadAsset({id: assetUid});
              } else if (!isLibrary) {
                history.push(`/forms/${assetUid}`);
              }
              notify(t('XLS Import completed'));
            }
          } else if (importData.status === 'processing') {
            // If the import task didn't complete immediately, inform the user accordingly.
            notify.warning(t('Your upload is being processed. This may take a few moments.'));
          } else if (importData.status === 'created') {
            notify.warning(t('Your upload is queued for processing. This may take a few moments.'));
          } else if (importData.status === 'error') {
            const errLines = [];
            errLines.push(t('Import Failed!'));
            if (params.name) {
              errLines.push(<code>Name: {params.name}</code>);
            }
            if (importData.messages?.error) {
              errLines.push(<code>${importData.messages.error_type}: ${escapeHtml(importData.messages.error)}</code>);
            }
            notify.error(<div>{join(errLines, <br/>)}</div>);
          } else {
            notify.error(t('Import Failed!'));
          }
        }).fail((failData: ImportResponse) => {
          notify.error(t('Import Failed!'));
          log('import failed', failData);
        });
        stores.pageState.hideModal();
      }, 2500);
    }, (jqxhr: string) => {
      log('Failed to create import: ', jqxhr);
      notify.error(t('Failed to create import.'));
    });
  },

  dropFiles(files: File[], rejectedFiles: File[], {}, pms = {}) {
    files.map((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const params = assign({
          name: file.name,
          base64Encoded: reader.result,
          lastModified: file.lastModified,
          totalFiles: files.length,
        }, pms);

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
};

mixins.clickAssets = {
  onActionButtonClick(action: string, uid: string, name: string) {
    this.click.asset[action].call(this, uid, name);
  },
  click: {
    asset: {
      clone: function (assetOrUid: AssetResponse | string) {
        let asset: AssetResponse;
        if (typeof assetOrUid === 'object') {
          asset = assetOrUid;
        } else {
          asset = stores.selectedAsset.asset || stores.allAssets.byUid[assetOrUid];
        }
        const assetTypeLabel = ASSET_TYPES[asset.asset_type].label;

        let newName;
        const displayName = assetUtils.getAssetDisplayName(asset);
        // propose new name only if source asset name is not empty
        if (displayName.original) {
          newName = `${t('Clone of')} ${displayName.original}`;
        }

        const dialog = alertify.dialog('prompt');
        const ok_button = (dialog.elements.buttons.primary.firstChild as HTMLElement);
        const opts = {
          title: `${t('Clone')} ${assetTypeLabel}`,
          message: t('Enter the name of the cloned ##ASSET_TYPE##. Leave empty to keep the original name.').replace('##ASSET_TYPE##', assetTypeLabel),
          value: newName,
          labels: {ok: t('Ok'), cancel: t('Cancel')},
          onok: ({}, value: string) => {
            ok_button.setAttribute('disabled', 'true');
            ok_button.innerText = t('Cloning...');

            let canAddToParent = false;
            if (asset.parent) {
              const foundParentAsset = myLibraryStore.findAssetByUrl(asset.parent);
              canAddToParent = (
                typeof foundParentAsset !== 'undefined' &&
                mixins.permissions.userCan(PERMISSIONS_CODENAMES.change_asset, foundParentAsset)
              );
            }

            actions.resources.cloneAsset({
              uid: asset.uid,
              name: value,
              parent: canAddToParent ? asset.parent : undefined,
            }, {
            onComplete: (asset: AssetResponse) => {
              ok_button.removeAttribute('disabled');
              dialog.destroy();

              // TODO when on collection landing page and user clones this
              // collection's child asset, instead of navigating to cloned asset
              // landing page, it would be better to stay here and refresh data
              // (if the clone will keep the parent asset)
              let goToUrl;
              if (asset.asset_type === ASSET_TYPES.survey.id) {
                goToUrl = `/forms/${asset.uid}/landing`;
              } else {
                goToUrl = `/library/asset/${asset.uid}`;
              }

              history.push(goToUrl);
              notify(t('cloned ##ASSET_TYPE## created').replace('##ASSET_TYPE##', assetTypeLabel));
            },
            });
            // keep the dialog open
            return false;
          },
          oncancel: () => {
            dialog.destroy();
          },
        };
        dialog.set(opts).show();
      },
      cloneAsTemplate: function (sourceUid: string, sourceName: string) {
        mixins.cloneAssetAsNewType.dialog({
          sourceUid: sourceUid,
          sourceName: sourceName,
          targetType: ASSET_TYPES.template.id,
          promptTitle: t('Create new template from this project'),
          promptMessage: t('Enter the name of the new template.'),
        });
      },
      cloneAsSurvey: function (sourceUid: string, sourceName: string) {
        mixins.cloneAssetAsNewType.dialog({
          sourceUid: sourceUid,
          sourceName: sourceName,
          targetType: ASSET_TYPES.survey.id,
          promptTitle: t('Create new project from this template'),
          promptMessage: t('Enter the name of the new project.'),
        });
      },
      edit: function (uid: string) {
        if (routerIsActive('library')) {
          history.push(`/library/asset/${uid}/edit`);
        } else {
          history.push(`/forms/${uid}/edit`);
        }
      },
      delete: function (
        assetOrUid: AssetResponse | string,
        name: string,
        callback: Function
      ) {
        let asset: AssetResponse;
        if (typeof assetOrUid === 'object') {
          asset = assetOrUid;
        } else {
          asset = stores.selectedAsset.asset || stores.allAssets.byUid[assetOrUid];
        }
        const assetTypeLabel = ASSET_TYPES[asset.asset_type].label;

        const safeName = _.escape(name);

        const dialog = alertify.dialog('confirm');
        const deployed = asset.has_deployment;
        let msg; let onshow;
        const onok = () => {
          actions.resources.deleteAsset({uid: asset.uid, assetType: asset.asset_type}, {
            onComplete: () => {
              notify(t('##ASSET_TYPE## deleted permanently').replace('##ASSET_TYPE##', assetTypeLabel));
              if (typeof callback === 'function') {
                callback();
              }
            },
          });
        };

        if (!deployed) {
          if (asset.asset_type !== ASSET_TYPES.survey.id) {
            msg = t('You are about to permanently delete this item from your library.');
          } else {
            msg = t('You are about to permanently delete this draft.');
          }
        } else {
          msg = `${t('You are about to permanently delete this form.')}`;
          if (asset.deployment__submission_count !== 0) {
            msg += `${renderCheckbox('dt1', t('All data gathered for this form will be deleted.'))}`;
          }
          msg += `${renderCheckbox('dt2', t('The form associated with this project will be deleted.'))}
            ${renderCheckbox('dt3', t('I understand that if I delete this project I will not be able to recover it.'), true)}
          `;

          onshow = () => {
            const ok_button = (dialog.elements.buttons.primary.firstChild as HTMLElement);
            ok_button.setAttribute( 'data-cy', 'delete' );
            const $els = $('.alertify-toggle input');

            ok_button.setAttribute('disabled', 'true');
            $els.each(function () {$(this).prop('checked', false);});

            $els.change(function () {
              ok_button.removeAttribute('disabled');
              $els.each(function () {
                if (!$(this).prop('checked')) {
                  ok_button.setAttribute('disabled', 'true');
                }
              });
            });
          };
        }
        const opts = {
          title: `${t('Delete')} ${assetTypeLabel} "${safeName}"`,
          message: msg,
          labels: {
            ok: t('Delete'),
            cancel: t('Cancel'),
          },
          onshow: onshow,
          onok: onok,
          oncancel: () => {
            dialog.destroy();
            $('.alertify-toggle input').prop('checked', false);
          },
        };
        dialog.set(opts).show();
      },
      deploy: function () {
        const asset = stores.selectedAsset.asset;
        mixins.dmix.deployAsset(asset);
      },
      archive: function (assetOrUid: AssetResponse | string, callback: Function) {
        let asset: AssetResponse;
        if (typeof assetOrUid === 'object') {
          asset = assetOrUid;
        } else {
          asset = stores.selectedAsset.asset || stores.allAssets.byUid[assetOrUid];
        }
        const dialog = alertify.dialog('confirm');
        const opts = {
          title: t('Archive Project'),
          message: `${t('Are you sure you want to archive this project?')} <br/><br/>
            <strong>${t('Your form will not accept submissions while it is archived.')}</strong>`,
          labels: {ok: t('Archive'), cancel: t('Cancel')},
          onok: () => {
            actions.resources.setDeploymentActive({
              asset: asset,
              active: false,
            });
            if (typeof callback === 'function') {
              callback();
            }
          },
          oncancel: () => {
            dialog.destroy();
          },
        };
        dialog.set(opts).show();
      },
      unarchive: function (assetOrUid: AssetResponse | string, callback: Function) {
        let asset: AssetResponse;
        if (typeof assetOrUid === 'object') {
          asset = assetOrUid;
        } else {
          asset = stores.selectedAsset.asset || stores.allAssets.byUid[assetOrUid];
        }
        const dialog = alertify.dialog('confirm');
        const opts = {
          title: t('Unarchive Project'),
          message: `${t('Are you sure you want to unarchive this project?')}`,
          labels: {ok: t('Unarchive'), cancel: t('Cancel')},
          onok: () => {
            actions.resources.setDeploymentActive({
              asset: asset,
              active: true,
            });
            if (typeof callback === 'function') {
              callback();
            }
          },
          oncancel: () => {
            dialog.destroy();
          },
        };
        dialog.set(opts).show();
      },
      sharing: function (uid: string) {
        stores.pageState.showModal({
          type: MODAL_TYPES.SHARING,
          assetid: uid,
        });
      },
      refresh: function () {
        stores.pageState.showModal({
          type: MODAL_TYPES.REPLACE_PROJECT,
          asset: stores.selectedAsset.asset,
        });
      },
      translations: function (uid: string) {
        stores.pageState.showModal({
          type: MODAL_TYPES.FORM_LANGUAGES,
          assetUid: uid,
        });
      },
      encryption: function (uid: string) {
        stores.pageState.showModal({
          type: MODAL_TYPES.ENCRYPT_FORM,
          assetUid: uid,
        });
      },
      removeSharing: function (uid: string) {
        /**
         * Extends `removeAllPermissions` from `userPermissionRow.es6`:
         * Checks for permissions from current user before finding correct
         * "most basic" permission to remove.
         */
        const asset = stores.selectedAsset.asset || stores.allAssets.byUid[uid];
        const userViewAssetPerm = asset.permissions.find((perm: Permission) => {
          // Get permissions url related to current user
          const permUserUrl = perm.user.split('/');
          return (
            permUserUrl[permUserUrl.length - 2] === sessionStore.currentAccount.username &&
            perm.permission === permConfig.getPermissionByCodename(PERMISSIONS_CODENAMES.view_asset)?.url
          );
        });

        const dialog = alertify.dialog('confirm');
        const opts = {
          title: t('Remove shared form'),
          message: `${t('Are you sure you want to remove this shared form?')}`,
          labels: {ok: t('Remove'), cancel: t('Cancel')},
          onok: () => {
            // Only non-owners should have the asset removed from their asset list.
            // This menu option is only open to non-owners so we don't need to check again.
            const isNonOwner = true;
            actions.permissions.removeAssetPermission(uid, userViewAssetPerm.url, isNonOwner);
          },
          oncancel: () => {
            dialog.destroy();
          },
        };
        dialog.set(opts).show();
      },

    },
  },
};

mixins.permissions = {
  /** For `.find`-ing the permissions */
  _doesPermMatch(perm: Permission, permName: string, partialPermName: string | null = null) {
    // Case 1: permissions don't match, stop looking
    if (perm.permission !== permConfig.getPermissionByCodename(permName)?.url) {
      return false;
    }

    // Case 2: permissions match, and we're not looking for partial one
    if (permName !== PERMISSIONS_CODENAMES.partial_submissions) {
      return true;
    }

    // Case 3a: we are looking for partial permission, but the name was no given
    if (!partialPermName) {
      return false;
    }

    // Case 3b: we are looking for partial permission, check if there are some that match
    return perm.partial_permissions?.some((partialPerm) => partialPerm.url === permConfig.getPermissionByCodename(partialPermName)?.url);
  },

  /**
   * This implementation does not use the back end to detect if `submission`
   * is writable or not. So far, the front end only supports filters like:
   *    `_submitted_by: {'$in': []}`
   * Let's search for `submissions._submitted_by` value among these `$in`
   * lists.
   */
  isSubmissionWritable(
    /** Permission to check if user can do at least partially */
    permName: string,
    asset: AssetResponse,
    submission: SubmissionResponse
  ) {
    // TODO optimize this to avoid calling `userCan()` and `userCanPartially()`
    // repeatedly in the table view
    // TODO Support multiple permissions at once
    const userCan = this.userCan(permName, asset);
    const userCanPartially = this.userCanPartially(permName, asset);

    // Case 1: User has full permission
    if (userCan) {
      return true;
    }

    // Case 2: User has neither full nor partial permission
    if (!userCanPartially) {
      return false;
    }

    // Case 3: User has only partial permission, and things are complicated
    const currentUsername = sessionStore.currentAccount.username;
    const partialPerms = asset.permissions.find((perm) => (
        perm.user === buildUserUrl(currentUsername) &&
        this._doesPermMatch(perm, PERMISSIONS_CODENAMES.partial_submissions, permName)
      ));

    const partialPerm = partialPerms?.partial_permissions?.find((nestedPerm) => nestedPerm.url === permConfig.getPermissionByCodename(permName)?.url);

    const submittedBy = submission._submitted_by;
    // If ther `_submitted_by` was not stored, there is no way of knowing.
    if (submittedBy === null) {
      return false;
    }

    let allowedUsers: string[] = [];

    partialPerm?.filters.forEach((filter) => {
      if (filter._submitted_by) {
        allowedUsers = allowedUsers.concat(filter._submitted_by.$in);
      }
    });
    return allowedUsers.includes(submittedBy);
  },

  // NOTE: be aware of the fact that some of non-TypeScript code is passing
  // things that are not AssetResponse (probably due to how dmix mixin is used
  // - merging asset response directly into component state object)
  userCan(permName: PermissionCodename, asset: AssetResponse, partialPermName = null) {
    // TODO: check out whether any other checks are really needed at this point.
    // Pay attention if partial permissions work.
    const hasEffectiveAccess = asset.effective_permissions?.some((effectivePerm) =>
      effectivePerm.codename === permName
    );
    if (hasEffectiveAccess) {
      return true;
    }

    if (!asset.permissions) {
      return false;
    }
    const currentUsername = sessionStore.currentAccount.username;

    if (asset.owner__username === currentUsername) {
      return true;
    }

    // if permission is granted publicly, then grant it to current user
    const anonAccess = asset.permissions.some((perm) => (
        perm.user === buildUserUrl(ANON_USERNAME) &&
        perm.permission === permConfig.getPermissionByCodename(permName)?.url
      ));
    if (anonAccess) {
      return true;
    }

    return asset.permissions.some((perm) => (
        perm.user === buildUserUrl(currentUsername) &&
        this._doesPermMatch(perm, permName, partialPermName)
      ));
  },

  /**
   * @param {string} permName
   * @param {Object} asset
   */
  userCanPartially(permName: string, asset: AssetResponse) {
    const currentUsername = sessionStore.currentAccount.username;

    // Owners cannot have partial permissions because they have full permissions.
    // Both are contradictory.
    if (asset.owner__username === currentUsername) {
      return false;
    }

    return this.userCan(PERMISSIONS_CODENAMES.partial_submissions, asset, permName);
  },

  /**
   * This checks if current user can remove themselves from a project that was
   * shared with them. If `view_asset` comes from `asset.effective_permissions`,
   * but doesn't exist in `asset.permissions` it means that `view_asset` comes
   * from Project View access, not from project being shared with user directly.
   */
  userCanRemoveSharedProject(asset: AssetResponse) {
    const currentUsername = sessionStore.currentAccount.username;
    const userHasDirectViewAsset = asset.permissions.some((perm) => (
      perm.user === buildUserUrl(currentUsername) &&
      this._doesPermMatch(perm, 'view_asset')
    ));

    return (
      !assetUtils.isSelfOwned(asset) &&
      this.userCan('view_asset', asset) &&
      userHasDirectViewAsset
    );
  },
};

mixins.contextRouter = {
  isFormList() {
    return routerIsActive(ROUTES.FORMS) && this.currentAssetID() === undefined;
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
    return routerIsActive(ROUTES.LIBRARY) && this.currentAssetID() !== undefined;
  },
  isFormSingle() {
    return routerIsActive(ROUTES.FORMS) && this.currentAssetID() !== undefined;
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
      uid !== undefined &&
      routerIsActive(ROUTES.EDIT_LIBRARY_ITEM.replace(':uid', uid)) ||
      routerIsActive(ROUTES.NEW_LIBRARY_ITEM.replace(':uid', uid)) ||
      routerIsActive(ROUTES.FORM_EDIT.replace(':uid', uid))
    );
  },
};

export default mixins;
