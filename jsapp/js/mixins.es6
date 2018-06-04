/*eslint no-unused-vars:0*/
import React from 'react';
import Reflux from 'reflux';
import alertify from 'alertifyjs';
import {Link, hashHistory} from 'react-router';
import DocumentTitle from 'react-document-title';
import classNames from 'classnames';

import {dataInterface} from './dataInterface';
import stores from './stores';
import bem from './bem';
import actions from './actions';
import ui from './ui';
import $ from 'jquery';

import {
  anonUsername,
  formatTime,
  currentLang,
  log,
  t,
  assign,
  notify,
  stringToColor
} from './utils';

import icons from '../xlform/src/view.icons';

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
      title: t('Clone form'),
      message: t('Enter the name of the cloned form'),
      value: name,
      labels: {ok: t('Ok'), cancel: t('Cancel')},
      onok: (evt, value) => {
        let uid = this.props.params.assetid;
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
  reDeployConfirm (asset, onComplete) {
    let dialog = alertify.dialog('confirm');
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
        actions.resources.deployAsset(asset, true, dialog, {
          onComplete: () => {
            notify(t('redeployed form'));
            actions.resources.loadAsset({id: asset.uid});
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
  deployAsset (asset, onComplete) {
    if (!asset || asset.kind != 'asset') {
        if (this.state && this.state.kind == 'asset') {
          asset = this.state;
        } else {
          console.error(
            'Neither the arguments nor the state supplied an asset.');
          return;
        }
    }
    if (!asset.has_deployment) {
      // There's no existing deployment for this asset
      let deployment_alert = alertify.warning(t('deploying to kobocat...'), 60);
      actions.resources.deployAsset(asset, false, deployment_alert, {
        onComplete: () => {
          notify(t('deployed form'));
          actions.resources.loadAsset({id: asset.uid});
          hashHistory.push(`/forms/${asset.uid}`);
        }
      });
    } else {
      // We are about to overwrite(!) an existing deployment
      this.reDeployConfirm(asset, onComplete);
    }
  },
  unarchiveAsset () {
    mixins.clickAssets.click.asset.unarchive.call(this, this.state);
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
    var uid = this.props.params.assetid || this.props.uid || this.props.params.uid,
      asset = data[uid];
    if (asset) {
      this.setState(assign({}, data[uid]));
    }
  },
  componentDidMount () {
    this.listenTo(stores.asset, this.dmixAssetStoreChange);

    var uid = this.props.params.assetid || this.props.uid || this.props.params.uid;
    if (this.props.randdelay && uid) {
      window.setTimeout(()=>{
        actions.resources.loadAsset({id: uid});
      }, Math.random() * 3000);
    } else if (uid) {
      actions.resources.loadAsset({id: uid});
    }
  }
};

mixins.droppable = {
  _forEachDroppedFile (params={}) {
    let router = this.context.router;
    let isXLSReplaceInForm = this.props.context == 'replaceXLS' && router.isActive('forms') && router.params.assetid != undefined;
    var library = router.isActive('library');
    var multipleFiles = params.totalFiles > 1 ? true : false;
    params = assign({library: library}, params);

    if (params.base64Encoded) {
      stores.pageState.showModal({
        type: 'uploading-xls',
        filename: multipleFiles ? t('## files').replace('##', params.totalFiles) : params.name
      });
    }

    delete params.totalFiles;

    if (!library && params.base64Encoded) {
      let destination = params.destination || this.state.url;
      if (destination) {
        params = assign({ destination: destination }, params);
      }
    }

    dataInterface.postCreateImport(params).then((data)=> {
      window.setTimeout((()=>{
        dataInterface.getImportDetails({
          uid: data.uid,
        }).done((importData) => {
          if (importData.status === 'complete') {
            var assetData = importData.messages.updated || importData.messages.created;
            var assetUid = assetData && assetData.length > 0 && assetData[0].uid;
            if (multipleFiles) {
              this.searchDefault();
              // No message shown for multiple files when successful, to avoid overloading screen
            } else {
              if (!assetUid) {
                // TODO: use a more specific error message here
                alertify.error(t('XLSForm Import failed. Check that the XLSForm and/or the URL are valid, and try again using the "Replace with XLS" icon.'));
                if (params.assetUid)
                  hashHistory.push(`/forms/${params.assetUid}`);
              } else {
                if (isXLSReplaceInForm) {
                  actions.resources.loadAsset({id: assetUid});
                } else if (library) {
                  this.searchDefault();
                } else {
                  hashHistory.push(`/forms/${assetUid}`);
                }
                notify(t('XLS Import completed'));
              }
            }
          }
          // If the import task didn't complete immediately, inform the user accordingly.
          else if (importData.status === 'processing') {
            alertify.warning(t('Your upload is being processed. This may take a few moments.'));
          } else if (importData.status === 'created') {
            alertify.warning(t('Your upload is queued for processing. This may take a few moments.'));
          } else if (importData.status === 'error')  {
            let error_message = t('Import Failure.');
            if (importData.messages.error)
              error_message = `<strong>${t('Import Failure.')}</strong><br><code><strong>${importData.messages.error_type}</strong><br>${importData.messages.error}</code>`;
            alertify.error(error_message);
          } else {
            alertify.error(t('Import Failure.'));
          }
        }).fail((failData)=>{
          alertify.error(t('Import Failed.'));
          log('import failed', failData);
        });
        stores.pageState.hideModal();
      }), 2500);
    }).fail((jqxhr)=> {
      log('Failed to create import: ', jqxhr);
      alertify.error(t('Failed to create import.'));
    });
  },
  dropFiles (files, rejectedFiles, evt, pms={}) {
    files.map((file) => {
      var reader = new FileReader();
      reader.onload = (e)=> {
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

mixins.collectionList = {
  getInitialState () {
    // initial state is a copy of "stores.collections.initialState"
    return assign({}, stores.collections.initialState);
  },
  listCollections () {
    actions.resources.listCollections();
  },
  componentDidMount () {
    this.listenTo(stores.collections, this.collectionsChanged);
  },
  collectionsChanged (collections) {
    this.setState(collections);
  },
};

mixins.clickAssets = {
  onActionButtonClick (action, uid, name) {
    this.click.asset[action].call(this, uid, name);
  },
  click: {
    asset: {
      clone: function(uid, name){
        let newName = `${t('Clone of')} ${name}`;
        let dialog = alertify.dialog('prompt');
        let opts = {
          title: t('Clone form'),
          message: t('Enter the name of the cloned form'),
          value: newName,
          labels: {ok: t('Ok'), cancel: t('Cancel')},
          onok: (evt, value) => {
            actions.resources.cloneAsset({
              uid: uid,
              name: value,
            }, {
            onComplete: (asset) => {
              dialog.destroy();
              notify(t('cloned project created'));
              this.refreshSearch && this.refreshSearch();
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
      edit: function (uid) {
        if (this.context.router.isActive('library'))
          hashHistory.push(`/library/${uid}/edit`);
        else
          hashHistory.push(`/forms/${uid}/edit`);
      },
      delete: function(uid){
        let asset = stores.selectedAsset.asset;
        var assetTypeLabel = t('project');

        if (asset.asset_type != 'survey') {
          assetTypeLabel = t('library item');
        }

        let dialog = alertify.dialog('confirm');
        let deployed = asset.has_deployment;
        let msg, onshow;
        let onok = (evt, val) => {
          actions.resources.deleteAsset({uid: uid}, {
            onComplete: ()=> {
              notify(`${assetTypeLabel} ${t('deleted permanently')}`);
              $('.alertify-toggle input').prop("checked", false);
            }
          });
        };

        if (!deployed) {
          if (asset.asset_type != 'survey')
            msg = t('You are about to permanently delete this item from your library.');
          else
            msg = t('You are about to permanently delete this draft.');
        } else {
          msg = `
            ${t('You are about to permanently delete this form.')}
            <div class="alertify-toggle"><input type="checkbox" id="dt1"/> <label for="dt1">${t('All data gathered for this form will be deleted.')}</label></div>
            <div class="alertify-toggle"><input type="checkbox" id="dt2"/> <label for="dt2">${t('All questions created for this form will be deleted.')}</label></div>
            <div class="alertify-toggle"><input type="checkbox" id="dt3"/> <label for="dt3">${t('The form associated with this project will be deleted.')}</label></div>
            <div class="alertify-toggle alertify-toggle-important"><input type="checkbox" id="dt4"/> <label for="dt4">${t('I understand that if I delete this project I will not be able to recover it.')}</label></div>
          `;
          onshow = (evt) => {
            let ok_button = dialog.elements.buttons.primary.firstChild;
            let $els = $('.alertify-toggle input');
            ok_button.disabled = true;
            $els.change(function () {
              ok_button.disabled = false;
              $els.each(function ( index ) {
                if (!$(this).prop('checked')) {
                  ok_button.disabled = true;
                }
              });
            });
          };
        }
        let opts = {
          title: `${t('Delete')} ${assetTypeLabel}`,
          message: msg,
          labels: {
            ok: t('Delete'),
            cancel: t('Cancel')
          },
          onshow: onshow,
          onok: onok,
          oncancel: () => {
            dialog.destroy();
            $('.alertify-toggle input').prop("checked", false);
          }
        };
        dialog.set(opts).show();
      },
      deploy: function(uid){
        let asset = stores.selectedAsset.asset;
        mixins.dmix.deployAsset(asset);
      },
      createTemplateFromProject: function(uid) {
        console.debug('createTemplateFromProject', uid);
        // TODO: call backend to create a template
      },
      createProjectFromTemplate: function(uid) {
        console.debug('createProjectFromTemplate', uid);

        const dialog = alertify.dialog('prompt');
        const opts = {
          title: t('Create project from template'),
          message: t('Enter the name of the project or leave empty to use Template name.'),
          value: name,
          labels: {
            ok: t('Create'),
            cancel: t('Cancel')
          },
          onok: (evt, value) => {
            // disable buttons
            dialog.elements.buttons.primary.children[0].setAttribute('disabled', true);
            dialog.elements.buttons.primary.children[0].innerText = t('Creating…');
            dialog.elements.buttons.primary.children[1].setAttribute('disabled', true);

            actions.resources.cloneAsset({
              uid: uid,
              name: value,
              new_asset_type: 'survey'
            }, {
              onComplete: (asset) => {
                dialog.destroy();
                notify(t('Project "##" has been created.').replace('##', asset.name));
              },
              onFailed: (asset) => {
                dialog.destroy();
                alertify.error(t('Failed to create project from template!'));
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
      },
      archive: function(uid) {
        let asset = stores.selectedAsset.asset;
        let dialog = alertify.dialog('confirm');
        let opts = {
          title: t('Archive Project'),
          message: `${t('Are you sure you want to archive this project?')} <br/><br/>
            <strong>${t('Your form will not accept submissions while it is archived.')}</strong>`,
          labels: {ok: t('Archive'), cancel: t('Cancel')},
          onok: (evt, val) => {
            actions.resources.setDeploymentActive(
              {
                asset: asset,
                active: false
              },
              {onComplete: ()=> {
                this.refreshSearch && this.refreshSearch();
                notify(t('archived project'));
              }}
            );
          },
          oncancel: () => {
            dialog.destroy();
          }
        };
        dialog.set(opts).show();
      },
      unarchive: function(assetOrUid) {
        let asset = (typeof assetOrUid == 'object') ? assetOrUid : stores.selectedAsset.asset;
        let dialog = alertify.dialog('confirm');
        let opts = {
          title: t('Unarchive Project'),
          message: `${t('Are you sure you want to unarchive this project?')}`,
          labels: {ok: t('Unarchive'), cancel: t('Cancel')},
          onok: (evt, val) => {
            actions.resources.setDeploymentActive(
              {
                asset: asset,
                active: true
              },
              {onComplete: ()=> {
                actions.resources.loadAsset({id: asset.uid});
                this.refreshSearch && this.refreshSearch();
                notify(t('unarchived project'));
              }}
            );
          },
          oncancel: () => {
            dialog.destroy();
          }
        };
        dialog.set(opts).show();
      },
      sharing: function(uid){
        stores.pageState.showModal({
          type: 'sharing',
          assetid: uid
        });
      },
      refresh: function(uid) {
        stores.pageState.showModal({
          type: 'replace-xls',
          asset: stores.selectedAsset.asset
        });
      }

    }
  },
};

mixins.permissions = {
  removePerm (permName, permObject, content_object_uid) {
    actions.permissions.removePerm({
      permission_url: permObject.url,
      content_object_uid: content_object_uid
    });
  },
  // PM: temporarily disabled
  // removeCollectionPublicPerm (collection, publicPerm) {
  //   return (evt) => {
  //     evt.preventDefault();
  //     if (collection.discoverable_when_public) {
  //       actions.permissions.setCollectionDiscoverability(
  //         collection.uid, false
  //       );
  //     }
  //     actions.permissions.removePerm({
  //       permission_url: publicPerm.url,
  //       content_object_uid: collection.uid
  //     });
  //   };
  // },
  setPerm (permName, props) {
    actions.permissions.assignPerm({
      username: props.username,
      uid: props.uid,
      kind: props.kind,
      objectUrl: props.objectUrl,
      role: permName
    });
  },
  userCan (permName, asset) {
    if (!asset.permissions)
      return false;

    if (!stores.session.currentAccount)
      return false;

    const currentUsername = stores.session.currentAccount.username;
    if (asset.owner__username === currentUsername)
      return true;

    // TODO: should super user always have access to all UI?
    // if (stores.session.currentAccount.is_superuser)
    //   return true;

    // if permission is granted publicly, then grant it to current user
    const anonAccess = asset.permissions.some(perm => perm.user__username === 'AnonymousUser' && perm.permission === permName);
    if (anonAccess)
      return true;

    const userPerms = asset.permissions.filter(perm => perm.user__username === currentUsername);
    return userPerms.some(p => p.permission === permName);
  }
};

mixins.contextRouter = {
  isFormList () {
    return this.context.router.isActive('forms') && this.context.router.params.assetid == undefined;
  },
  isLibrary () {
    return this.context.router.isActive('library');
  },
  isFormSingle () {
    return this.context.router.isActive('forms') && this.context.router.params.assetid != undefined;
  },
  currentAssetID () {
    return this.context.router.params.assetid;
  },
  isActiveRoute (path, indexOnly = false) {
    return this.context.router.isActive(path, indexOnly);
  },
  isFormBuilder () {
    if (this.context.router.isActive(`/library/new`))
      return true;

    if (this.context.router.isActive(`/library/new/template`))
      return true;

    if (this.context.router.params.assetid == undefined)
      return false

    var assetid = this.context.router.params.assetid;
    if (this.context.router.isActive(`/library/${assetid}/edit`))
      return true;

    return this.context.router.isActive(`/forms/${assetid}/edit`);
  }
}
export default mixins;
