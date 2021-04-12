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
 */

import _ from 'underscore';
import React from 'react';
import alertify from 'alertifyjs';
import {hashHistory} from 'react-router';
import assetUtils from 'js/assetUtils';
import {
  PROJECT_SETTINGS_CONTEXTS,
  MODAL_TYPES,
  ASSET_TYPES,
  ANON_USERNAME,
  PERMISSIONS_CODENAMES,
  ROUTES,
} from './constants';
import {dataInterface} from './dataInterface';
import {stores} from './stores';
import {actions} from './actions';
import permConfig from 'js/components/permissions/permConfig';
import {
  log,
  assign,
  notify,
  escapeHtml,
  buildUserUrl,
  renderCheckbox
} from 'utils';
import myLibraryStore from 'js/components/library/myLibraryStore';

const IMPORT_CHECK_INTERVAL = 1000;

var mixins = {};

mixins.dmix = {
  afterCopy() {
    notify(t('copied to clipboard'));
  },
  saveCloneAs (evt) {
    let version_id = evt.currentTarget.dataset.versionId;
    let name = `${t('Clone of')} ${this.state.name}`;

    let dialog = alertify.dialog('prompt');
    let opts = {
      title: `${t('Clone')} ${ASSET_TYPES.survey.label}`,
      message: t('Enter the name of the cloned ##ASSET_TYPE##.').replace('##ASSET_TYPE##', ASSET_TYPES.survey.label),
      value: name,
      labels: {ok: t('Ok'), cancel: t('Cancel')},
      onok: (evt, value) => {
        const uid = this.props.params.assetid || this.props.params.uid;
        actions.resources.cloneAsset({
          uid: uid,
          name: value,
          version_id: version_id,
        }, {
          onComplete: (asset) => {
            dialog.destroy();
            hashHistory.push(`/forms/${asset.uid}`);
          }
        });

        // keep the dialog open
        return false;
      },
      oncancel: () => {
        dialog.destroy();
      }
    };
    dialog.set(opts).show();
  },
  cloneAsTemplate: function(evt) {
    const sourceUid = evt.currentTarget.dataset.assetUid;
    const sourceName = evt.currentTarget.dataset.assetName;
    mixins.cloneAssetAsNewType.dialog({
      sourceUid: sourceUid,
      sourceName: sourceName,
      targetType: ASSET_TYPES.template.id,
      promptTitle: t('Create new template from this project'),
      promptMessage: t('Enter the name of the new template.')
    });
  },
  _deployAssetFirstTime (asset) {
    let deployment_alert = alertify.warning(t('deploying to kobocat...'), 60);
    actions.resources.deployAsset(asset, false, {
      onDone: () => {
        notify(t('deployed form'));
        actions.resources.loadAsset({id: asset.uid});
        hashHistory.push(`/forms/${asset.uid}`);
        if (deployment_alert && typeof deployment_alert.dismiss === 'function') {
          deployment_alert.dismiss();
        }
      },
      onFail: () => {
        if (deployment_alert && typeof deployment_alert.dismiss === 'function') {
          deployment_alert.dismiss();
        }
      }
    });
  },
  _redeployAsset (asset) {
    const dialog = alertify.dialog('confirm');
    let opts = {
      title: t('Overwrite existing deployment'),
      message: t(
        'This form has already been deployed. Are you sure you ' +
        'want overwrite the existing deployment? ' +
        '<br/><br/><strong>This action cannot be undone.</strong>'
      ),
      labels: {ok: t('Ok'), cancel: t('Cancel')},
      onok: (evt, val) => {
        let ok_button = dialog.elements.buttons.primary.firstChild;
        ok_button.disabled = true;
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
          }
        });
        // keep the dialog open
        return false;
      },
      oncancel: () => {
        dialog.destroy();
      }
    };
    dialog.set(opts).show();
  },
  deployAsset (asset) {
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
  archiveAsset (uid, callback) {
    mixins.clickAssets.click.asset.archive(uid, callback);
  },
  unarchiveAsset (uid = null, callback) {
    if (uid === null) {
      mixins.clickAssets.click.asset.unarchive(this.state, callback);
    } else {
      mixins.clickAssets.click.asset.unarchive(uid, callback);
    }
  },
  deleteAsset(assetOrUid, name, callback) {
    mixins.clickAssets.click.asset.delete(assetOrUid, name, callback);
  },
  toggleDeploymentHistory () {
    this.setState({
      historyExpanded: !this.state.historyExpanded,
    });
  },
  summaryDetails () {
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
  dmixAssetStoreChange (data) {
    const uid = this._getAssetUid();
    const asset = data[uid];
    if (asset) {
      this.setState(assign({}, data[uid]));
    }
  },
  _getAssetUid () {
    if (this.props.params) {
      return this.props.params.assetid || this.props.params.uid;
    } else if (this.props.formAsset) {
      // formAsset case is being used strictly for projectSettings component to
      // cause the componentDidMount callback to load the full asset (i.e. one
      // that includes `content`).
      return this.props.formAsset.uid;
    } else {
      return this.props.uid;
    }
  },
  // TODO
  // Fix `componentWillUpdate` and `componentDidMount` asset loading flow.
  // Ideally we should build a single overaching component that would
  // handle loading of the asset in all necessary cases in a way that all
  // interested parties could use without duplication or confusion and with
  // indication when the loading starts and when ends.
  componentWillUpdate(newProps) {
    if (
      this.props.params?.uid !== newProps.params?.uid
    ) {
      // This case is used by other components (header.es6 is one such component)
      // in a not clear way to gain a data on new asset.
      actions.resources.loadAsset({id: newProps.params.uid});
    }
  },
  componentDidMount() {
    this.listenTo(stores.asset, this.dmixAssetStoreChange);

    const uid = this._getAssetUid();
    if (uid) {
      actions.resources.loadAsset({id: uid});
    }
  },
};

/*
 * helper function for apply*ToAsset droppable mixin methods
 * returns an interval-driven promise
 */
const applyImport = (params) => {
  const applyPromise = new Promise((resolve, reject) => {
    actions.resources.createImport(params, (data) => {
      const doneCheckInterval = setInterval(() => {
        dataInterface.getImportDetails({
          uid: data.uid,
        }).done((importData) => {
          switch (importData.status) {
            case 'complete': {
              const finalData = importData.messages.updated || importData.messages.created;
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
        }).fail((failData) => {
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
  applyFileToAsset(file, asset) {
    const applyPromise = new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const params = {
          destination: asset.url,
          assetUid: asset.uid,
          name: file.name,
          base64Encoded: evt.target.result,
          lastModified: file.lastModified,
          totalFiles: 1
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
  applyUrlToAsset(url, asset) {
    const applyPromise = new Promise((resolve, reject) => {
      const params = {
        destination: asset.url,
        url: url,
        name: asset.name,
        assetUid: asset.uid
      };

      applyImport(params).then(
        (data) => {resolve(data);},
        (data) => {reject(data);}
      );
    });
    return applyPromise;
  },

  _forEachDroppedFile(params = {}) {
    let router = this.context.router;
    let isProjectReplaceInForm = (
      this.props.context === PROJECT_SETTINGS_CONTEXTS.REPLACE
      && router.isActive('forms')
      && router.params.uid !== undefined
    );
    var isLibrary = router.isActive('library');
    var multipleFiles = params.totalFiles > 1 ? true : false;
    params = assign({library: isLibrary}, params);

    if (params.base64Encoded) {
      stores.pageState.showModal({
        type: MODAL_TYPES.UPLOADING_XLS,
        filename: multipleFiles ? t('## files').replace('##', params.totalFiles) : params.name
      });
    }

    delete params.totalFiles;

    if (!isLibrary && params.base64Encoded) {
      let destination = params.destination || this.state.url;
      if (destination) {
        params = assign({ destination: destination }, params);
      }
    }

    actions.resources.createImport(params, (data) => {
      // TODO get rid of this barbaric method of waiting a magic number of seconds
      // to check if import was done - possibly while doing
      // https://github.com/kobotoolbox/kpi/issues/476
      window.setTimeout(() => {
        dataInterface.getImportDetails({
          uid: data.uid,
        }).done((importData) => {
          if (importData.status === 'complete') {
            var assetData = importData.messages.updated || importData.messages.created;
            var assetUid = assetData && assetData.length > 0 && assetData[0].uid;
            if (!isLibrary && multipleFiles) {
              this.searchDefault();
              // No message shown for multiple files when successful, to avoid overloading screen
            } else if (!assetUid) {
              // TODO: use a more specific error message here
              alertify.error(t('XLSForm Import failed. Check that the XLSForm and/or the URL are valid, and try again using the "Replace form" icon.'));
              if (params.assetUid) {
                hashHistory.push(`/forms/${params.assetUid}`);
              }
            } else {
              if (isProjectReplaceInForm) {
                actions.resources.loadAsset({id: assetUid});
              } else if (!isLibrary) {
                hashHistory.push(`/forms/${assetUid}`);
              }
              notify(t('XLS Import completed'));
            }
          } else if (importData.status === 'processing') {
            // If the import task didn't complete immediately, inform the user accordingly.
            alertify.warning(t('Your upload is being processed. This may take a few moments.'));
          } else if (importData.status === 'created') {
            alertify.warning(t('Your upload is queued for processing. This may take a few moments.'));
          } else if (importData.status === 'error') {
            const errLines = [];
            errLines.push(t('Import Failed!'));
            if (params.name) {
              errLines.push(`<code>Name: ${params.name}</code>`);
            }
            if (importData.messages.error) {
              errLines.push(`<code>${importData.messages.error_type}: ${escapeHtml(importData.messages.error)}</code>`);
            }
            alertify.error(errLines.join('<br/>'));
          } else {
            alertify.error(t('Import Failed!'));
          }
        }).fail((failData) => {
          alertify.error(t('Import Failed!'));
          log('import failed', failData);
        });
        stores.pageState.hideModal();
      }, 2500);
    }, (jqxhr) => {
      log('Failed to create import: ', jqxhr);
      alertify.error(t('Failed to create import.'));
    });
  },

  dropFiles (files, rejectedFiles, evt, pms = {}) {
    files.map((file) => {
      var reader = new FileReader();
      reader.onload = (e) => {
        let params = assign({
          base64Encoded: e.target.result,
          name: file.name,
          lastModified: file.lastModified,
          totalFiles: files.length
        }, pms);

        this._forEachDroppedFile(params);
      };
      reader.readAsDataURL(file);
    });

    for (var i = 0; i < rejectedFiles.length; i++) {
      if (rejectedFiles[i].type && rejectedFiles[i].name) {
        var errMsg = t('Upload error: could not recognize Excel file.');
        errMsg += ` (${t('Uploaded file name: ')} ${rejectedFiles[i].name})`;
        alertify.error(errMsg);
      } else {
        alertify.error(t('Could not recognize the dropped item(s).'));
        break;
      }
    }
  }
};

mixins.clickAssets = {
  onActionButtonClick (action, uid, name) {
    this.click.asset[action].call(this, uid, name);
  },
  click: {
    asset: {
      clone: function(assetOrUid) {
        let asset;
        if (typeof assetOrUid === 'object') {
          asset = assetOrUid;
        } else {
          asset = stores.selectedAsset.asset || stores.allAssets.byUid[assetOrUid];
        }
        let assetTypeLabel = ASSET_TYPES[asset.asset_type].label;

        let newName;
        const displayName = assetUtils.getAssetDisplayName(asset);
        // propose new name only if source asset name is not empty
        if (displayName.original) {
          newName = `${t('Clone of')} ${displayName.original}`;
        }

        let dialog = alertify.dialog('prompt');
        let ok_button = dialog.elements.buttons.primary.firstChild;
        let opts = {
          title: `${t('Clone')} ${assetTypeLabel}`,
          message: t('Enter the name of the cloned ##ASSET_TYPE##.').replace('##ASSET_TYPE##', assetTypeLabel),
          value: newName,
          labels: {ok: t('Ok'), cancel: t('Cancel')},
          onok: (evt, value) => {
            ok_button.disabled = true;
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
              parent: canAddToParent ? asset.parent : undefined
            }, {
            onComplete: (asset) => {
              ok_button.disabled = false;
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

              hashHistory.push(goToUrl);
              notify(t('cloned ##ASSET_TYPE## created').replace('##ASSET_TYPE##', assetTypeLabel));
            }
            });
            // keep the dialog open
            return false;
          },
          oncancel: () => {
            dialog.destroy();
          }
        };
        dialog.set(opts).show();
      },
      cloneAsTemplate: function(sourceUid, sourceName) {
        mixins.cloneAssetAsNewType.dialog({
          sourceUid: sourceUid,
          sourceName: sourceName,
          targetType: ASSET_TYPES.template.id,
          promptTitle: t('Create new template from this project'),
          promptMessage: t('Enter the name of the new template.')
        });
      },
      cloneAsSurvey: function(sourceUid, sourceName) {
        mixins.cloneAssetAsNewType.dialog({
          sourceUid: sourceUid,
          sourceName: sourceName,
          targetType: ASSET_TYPES.survey.id,
          promptTitle: t('Create new project from this template'),
          promptMessage: t('Enter the name of the new project.')
        });
      },
      edit: function (uid) {
        if (this.context.router.isActive('library')) {
          hashHistory.push(`/library/asset/${uid}/edit`);
        } else {
          hashHistory.push(`/forms/${uid}/edit`);
        }
      },
      delete: function(assetOrUid, name, callback) {
        let asset;
        if (typeof assetOrUid === 'object') {
          asset = assetOrUid;
        } else {
          asset = stores.selectedAsset.asset || stores.allAssets.byUid[assetOrUid];
        }
        let assetTypeLabel = ASSET_TYPES[asset.asset_type].label;

        const safeName = _.escape(name);

        let dialog = alertify.dialog('confirm');
        let deployed = asset.has_deployment;
        let msg, onshow;
        let onok = (evt, val) => {
          actions.resources.deleteAsset({uid: asset.uid, assetType: asset.asset_type}, {
            onComplete: ()=> {
              notify(t('##ASSET_TYPE## deleted permanently').replace('##ASSET_TYPE##', assetTypeLabel));
              if (typeof callback === 'function') {
                callback();
              }
            }
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
          onshow = (evt) => {
            let ok_button = dialog.elements.buttons.primary.firstChild;
            let $els = $('.alertify-toggle input');

            ok_button.disabled = true;
            $els.each(function () {$(this).prop('checked', false);});

            $els.change(function () {
              ok_button.disabled = false;
              $els.each(function () {
                if (!$(this).prop('checked')) {
                  ok_button.disabled = true;
                }
              });
            });
          };
        }
        let opts = {
          title: `${t('Delete')} ${assetTypeLabel} "${safeName}"`,
          message: msg,
          labels: {
            ok: t('Delete'),
            cancel: t('Cancel')
          },
          onshow: onshow,
          onok: onok,
          oncancel: () => {
            dialog.destroy();
            $('.alertify-toggle input').prop('checked', false);
          }
        };
        dialog.set(opts).show();
      },
      deploy: function(uid){
        let asset = stores.selectedAsset.asset;
        mixins.dmix.deployAsset(asset);
      },
      archive: function(assetOrUid, callback) {
        let asset;
        if (typeof assetOrUid === 'object') {
          asset = assetOrUid;
        } else {
          asset = stores.selectedAsset.asset || stores.allAssets.byUid[assetOrUid];
        }
        let dialog = alertify.dialog('confirm');
        let opts = {
          title: t('Archive Project'),
          message: `${t('Are you sure you want to archive this project?')} <br/><br/>
            <strong>${t('Your form will not accept submissions while it is archived.')}</strong>`,
          labels: {ok: t('Archive'), cancel: t('Cancel')},
          onok: (evt, val) => {
            actions.resources.setDeploymentActive({
              asset: asset,
              active: false
            });
            if (typeof callback === 'function') {
              callback();
            }
          },
          oncancel: () => {
            dialog.destroy();
          }
        };
        dialog.set(opts).show();
      },
      unarchive: function(assetOrUid, callback) {
        let asset;
        if (typeof assetOrUid === 'object') {
          asset = assetOrUid;
        } else {
          asset = stores.selectedAsset.asset || stores.allAssets.byUid[assetOrUid];
        }
        let dialog = alertify.dialog('confirm');
        let opts = {
          title: t('Unarchive Project'),
          message: `${t('Are you sure you want to unarchive this project?')}`,
          labels: {ok: t('Unarchive'), cancel: t('Cancel')},
          onok: (evt, val) => {
            actions.resources.setDeploymentActive({
              asset: asset,
              active: true
            });
            if (typeof callback === 'function') {
              callback();
            }
          },
          oncancel: () => {
            dialog.destroy();
          }
        };
        dialog.set(opts).show();
      },
      sharing: function(uid){
        stores.pageState.showModal({
          type: MODAL_TYPES.SHARING,
          assetid: uid
        });
      },
      refresh: function(uid) {
        stores.pageState.showModal({
          type: MODAL_TYPES.REPLACE_PROJECT,
          asset: stores.selectedAsset.asset
        });
      },
      translations: function(uid) {
        stores.pageState.showModal({
          type: MODAL_TYPES.FORM_LANGUAGES,
          assetUid: uid
        });
      },
      encryption: function(uid) {
        stores.pageState.showModal({
          type: MODAL_TYPES.ENCRYPT_FORM,
          assetUid: uid
        });
      },
      removeSharing: function(uid) {
        /**
         * Extends `removeAllPermissions` from `userPermissionRow.es6`:
         * Checks for permissions from current user before finding correct
         * "most basic" permission to remove.
         */
        const asset = stores.selectedAsset.asset || stores.allAssets.byUid[uid];
        const userViewAssetPerm = asset.permissions.find((perm) => {
          // Get permissions url related to current user
          var permUserUrl = perm.user.split('/');
          return (
            permUserUrl[permUserUrl.length - 2] === stores.session.currentAccount.username &&
            perm.permission === permConfig.getPermissionByCodename(PERMISSIONS_CODENAMES.view_asset).url
          );
        });

        let dialog = alertify.dialog('confirm');
        let opts = {
          title: t('Remove shared form'),
          message: `${t('Are you sure you want to remove this shared form?')}`,
          labels: {ok: t('Remove'), cancel: t('Cancel')},
          onok: (evt, val) => {
            // Only non-owners should have the asset removed from their asset list.
            // This menu option is only open to non-owners so we don't need to check again.
            let isNonOwner = true;
            actions.permissions.removeAssetPermission(uid, userViewAssetPerm.url, isNonOwner);
          },
          oncancel: () => {
            dialog.destroy();
          }
        };
        dialog.set(opts).show();
      },

    }
  },
};

mixins.permissions = {
  userCan (permName, asset) {
    if (!asset.permissions) {
      return false;
    }

    if (!stores.session.currentAccount) {
      return false;
    }

    const currentUsername = stores.session.currentAccount.username;
    if (asset.owner__username === currentUsername) {
      return true;
    }

    // if permission is granted publicly, then grant it to current user
    const anonAccess = asset.permissions.some((perm) => {
      return (
        perm.user === buildUserUrl(ANON_USERNAME) &&
        perm.permission === permConfig.getPermissionByCodename(permName).url
      );
    });
    if (anonAccess) {
      return true;
    }

    return asset.permissions.some((perm) => {
      return (
        perm.user === buildUserUrl(currentUsername) &&
        perm.permission === permConfig.getPermissionByCodename(permName).url
      );
    });
  }
};

mixins.contextRouter = {
  isFormList() {
    return this.context.router.isActive(ROUTES.FORMS) && this.currentAssetID() === undefined;
  },
  isLibrary() {
    return this.context.router.isActive(ROUTES.LIBRARY);
  },
  isMyLibrary() {
    return this.context.router.isActive(ROUTES.MY_LIBRARY);
  },
  isPublicCollections() {
    return this.context.router.isActive(ROUTES.PUBLIC_COLLECTIONS);
  },
  isLibraryList() {
    return this.context.router.isActive(ROUTES.LIBRARY) && this.currentAssetID() === undefined;
  },
  isLibrarySingle() {
    return this.context.router.isActive(ROUTES.LIBRARY) && this.currentAssetID() !== undefined;
  },
  isFormSingle() {
    return this.context.router.isActive(ROUTES.FORMS) && this.currentAssetID() !== undefined;
  },
  currentAssetID() {
    return this.context.router.params.assetid || this.context.router.params.uid;
  },
  currentAsset() {
    return stores.asset.data[this.currentAssetID()];
  },
  isActiveRoute(path, indexOnly = false) {
    return this.context.router.isActive(path, indexOnly);
  },
  isFormBuilder() {
    if (this.context.router.isActive(ROUTES.NEW_LIBRARY_ITEM)) {
      return true;
    }

    const uid = this.currentAssetID();
    return (
      uid !== undefined &&
      this.context.router.isActive(ROUTES.EDIT_LIBRARY_ITEM.replace(':uid', uid)) ||
      this.context.router.isActive(ROUTES.NEW_LIBRARY_ITEM.replace(':uid', uid)) ||
      this.context.router.isActive(ROUTES.FORM_EDIT.replace(':uid', uid))
    );
  }
};

/*
 * generates dialog when cloning an asset as new type
 */
mixins.cloneAssetAsNewType = {
  dialog(params) {
    const dialog = alertify.dialog('prompt');
    const opts = {
      title: params.promptTitle,
      message: params.promptMessage,
      value: _.escape(params.sourceName),
      labels: {ok: t('Create'), cancel: t('Cancel')},
      onok: (evt, value) => {
        // disable buttons
        dialog.elements.buttons.primary.children[0].setAttribute('disabled', true);
        dialog.elements.buttons.primary.children[0].innerText = t('Please wait…');
        dialog.elements.buttons.primary.children[1].setAttribute('disabled', true);

        actions.resources.cloneAsset({
          uid: params.sourceUid,
          name: value,
          new_asset_type: params.targetType
        }, {
          onComplete: (asset) => {
            dialog.destroy();

            switch (asset.asset_type) {
              case ASSET_TYPES.survey.id:
                hashHistory.push(ROUTES.FORM_LANDING.replace(':uid', asset.uid));
                break;
              case ASSET_TYPES.template.id:
              case ASSET_TYPES.block.id:
              case ASSET_TYPES.question.id:
                hashHistory.push(ROUTES.LIBRARY);
                break;
            }
          },
          onFailed: (asset) => {
            dialog.destroy();
            alertify.error(t('Failed to create new asset!'));
          }
        });

        // keep the dialog open
        return false;
      },
      oncancel: (evt, value) => {
        dialog.destroy();
      }
    };
    dialog.set(opts).show();
  }
};

export default mixins;
