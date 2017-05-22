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
  getAnonymousUserPermission,
  parsePermissions,
  anonUsername,
  formatTime,
  currentLang,
  log,
  t,
  assign,
  notify,
  isLibrary,
  stringToColor
} from './utils';

import icons from '../xlform/src/view.icons';
  
var mixins = {};

var dmix = {
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
      message: t('This form has already been deployed. Are you sure you ' +
                 'want overwrite the existing deployment? ' +
                 '<br/><br/><strong>This action cannot be undone.</strong>'),
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
  toggleDeploymentHistory () {
    this.setState({
      historyExpanded: !this.state.historyExpanded,
    });
  },
  onDrop (files) {
    if (files.length === 0) {
      return;
    } else if (files.length> 1) {
      var errMsg = t('Only 1 file can be uploaded in this case');
      alertify.error(errMsg);
      throw new Error(errMsg);
    }
    const VALID_ASSET_UPLOAD_FILE_TYPES = [
      'application/xls',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];
    var file = files[0];
    if (VALID_ASSET_UPLOAD_FILE_TYPES.indexOf(file.type) === -1) {
      var err = `Invalid filetype: '${file.type}'`;
      console.error(err);
    }
    this.dropFiles(files);
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
  isOwner() {
    if (!this.state.owner__username || !this.state.currentUsername) {
      return false;
    }
    return this.state.currentUsername === this.state.owner__username;
  },
  getCurrentUserPermissions ({access}, {currentUsername}) {
    var ownerUsername = access && access.ownerUsername;
    var isOwner = currentUsername === ownerUsername;
    var canEdit;
    var canView;
    canEdit = isOwner || access && access.change[currentUsername];
    canView = isOwner || access && access.view[currentUsername];
    return {
      userCanEdit: !!canEdit,
      userCanView: !!canView,
      isOwner: isOwner
    };
  },
  dmixSessionStoreChange (val) {
    var currentUsername = val && val.currentAccount && val.currentAccount.username;
    this.setState(assign({
        currentUsername: currentUsername
      },
      this.getCurrentUserPermissions(this.state, {currentUsername: currentUsername})
    ));
  },
  getInitialState () {
    return {
      userCanEdit: false,
      userCanView: true,
      historyExpanded: false,
      showReportGraphSettings: false,
      currentUsername: stores.session.currentAccount && stores.session.currentAccount.username,
    };
  },
  dmixAssetStoreChange (data) {
    var uid = this.props.params.assetid || this.props.uid || this.props.params.uid,
      asset = data[uid];
    if (asset) {
      this.setState(assign({},
          data[uid],
          this.getCurrentUserPermissions(data[uid], this.state)
        ));
    }
  },
  componentDidMount () {
    this.listenTo(stores.session, this.dmixSessionStoreChange);
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

mixins.dmix = dmix;
 
mixins.droppable = {
  contextTypes: {
    router: React.PropTypes.object
  },
  _forEachDroppedFile (evt, file, params={}) {
    var library = this.context.router.isActive('library');
    var url = params.url || this.state.url;

    stores.pageState.showModal({
      type: 'uploading-xls',
      file: file,
      url: url
    });

    dataInterface.postCreateBase64EncodedImport(assign({
        base64Encoded: evt.target.result,
        name: file.name,
        library: library,
        lastModified: file.lastModified,
      }, url ? {
        destination: url,
      } : null
    )).then((data)=> {
      window.setTimeout((()=>{
        dataInterface.getImportDetails({
          uid: data.uid,
        }).done((importData/*, status, jqxhr*/) => {
          if (importData.status === 'complete') {
            var assetData = importData.messages.updated || importData.messages.created;
            var assetUid = assetData && assetData.length > 0 && assetData[0].uid,
                isCurrentPage = this.state.uid === assetUid;
 
            if (!assetUid) {
              alertify.error(t('Could not redirect to asset.'));
            } else {
              if (isCurrentPage) {
                actions.resources.loadAsset({id: assetUid});
              } else if (library) {
                this.searchDefault();
              } else {
                hashHistory.push(`/forms/${assetUid}`);
              }
              if (url) {
                notify(t('Replace operation completed'));
              } else {
                notify(t('XLS Upload completed'));
              }
            }
          }
          // If the import task didn't complete immediately, inform the user accordingly.
          else if (importData.status === 'processing') {
            alertify.warning(t('Your library assets have uploaded and are being processed. This may take a few moments.'));
          } else if (importData.status === 'created') {
            alertify.warning(t('Your library assets have uploaded and are queued for processing. This may take a few moments.'));
          } else if (importData.status === 'error')  {
            var error_message= `<strong>Import Error.</strong><br><code><strong>${importData.messages.error_type}</strong><br>${importData.messages.error}</code>`
            alertify.error(t(error_message));
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
  dropFiles (files, rejectedFiles, params={}) {
    files.map((file) => {
      var reader = new FileReader();
      reader.onload = (e)=>{
        var f = this.forEachDroppedFile || this._forEachDroppedFile;
        f.call(this, e, file, params);
      };
      reader.readAsDataURL(file);
    });
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
  contextTypes: {
    router: React.PropTypes.object
  },
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
              this.refreshSearch && this.refreshSearch();
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
        dmix.deployAsset(asset);
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
      sharing: function(uid){
        stores.pageState.showModal({
          type: 'sharing', 
          assetid: uid
        });
      },

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
  }
};

mixins.contextRouter = {
  contextTypes: {
    router: React.PropTypes.object
  },
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
    
    if (this.context.router.params.assetid == undefined)
      return false

    var assetid = this.context.router.params.assetid;
    if (this.context.router.isActive(`/library/${assetid}/edit`))
      return true;

    return this.context.router.isActive(`/forms/${assetid}/edit`);
  },

}
export default mixins;
