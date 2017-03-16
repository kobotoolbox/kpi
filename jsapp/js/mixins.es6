/*eslint no-unused-vars:0*/
import React from 'react/addons';
import Dropzone from './libs/dropzone';
import Select from 'react-select';
import alertify from 'alertifyjs';
import {Link} from 'react-router';
import mdl from './libs/rest_framework/material';
import TagsInput from 'react-tagsinput';
import DocumentTitle from 'react-document-title';
 
import {dataInterface} from './dataInterface';
import stores from './stores';
import bem from './bem';
import actions from './actions';
import ui from './ui';
import $ from 'jquery';

import {
  formatTime,
  currentLang,
  customConfirm,
  customConfirmAsync,
  customPromptAsync,
  log,
  t,
  assign,
  notify,
  isLibrary,
} from './utils';
import {
  ProjectSettingsEditor,
  ProjectDownloads
} from './components/formEditors';

import icons from '../xlform/src/view.icons';
  
var mixins = {};

mixins.taggedAsset = {
  mixins: [
    React.addons.LinkedStateMixin
  ],
  tagChange (tags/*, changedTag*/) {
    var uid = this.props.uid || this.props.params.assetid;
    actions.resources.updateAsset(uid, {
      tag_string: tags.join(',')
    });
  },
  linkTagState () {
    // because onChange doesn't work when valueLink is specified.
    var that = this, ls = this.linkState('tags'), rc = ls.requestChange;
    ls.requestChange = function(...args) {
      that.tagChange(...args);
      rc.apply(this, args);
    };
    return ls;
  },
  adaptInputSize (e) {
    var l = e.target.value.length;
    e.target.size = l + 5;
  },
  renderTaggedAssetTags () {
    var transform = function(tag) {
      // Behavior should match KpiTaggableManager.add()
      return tag.trim().replace(/ /g, '-');
    };
    // react-tagsinput splits on tab (9) and enter (13) by default; we want to
    // split on comma (188) as well
    var addKeys = [9, 13, 188];
    return (
      <div>
        <TagsInput ref="tags" classNamespace="k"
          valueLink={this.linkTagState()} transform={transform} onKeyUp={this.adaptInputSize}
          addKeys={addKeys} placeholder={t('#tags +')}/>
      </div>
    );
  }
};
 
var dmix = {
  afterCopy() {
    notify(t('copied to clipboard'));
  },
  saveCloneAs (evt) {
    let version_id = evt.currentTarget.dataset.versionId;
    var baseName = isLibrary(this.context.router) ? 'library-' : '';
    customPromptAsync(t('new form name'))
      .then((value) => {
        let uid = this.props.params.assetid;
        actions.resources.cloneAsset({
          uid: uid,
          name: value,
          version_id: version_id,
        }, {
          onComplete: (asset) => {
            this.transitionTo(`${baseName}form-landing`, {
              assetid: asset.uid,
            });
          }
        });
      });
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
            if (onComplete) {
              onComplete(asset);
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
          if (onComplete) {
            onComplete(asset);
          }
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
  _forEachDroppedFile (evt, file, params={}) {
    var library = isLibrary(this.context.router);
    var url = params.url || this.state.url;
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
                this.transitionTo('form-landing', {assetid: assetUid});
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
      }), 2500);
    }).fail((jqxhr)=> {
      log('Failed to create import: ', jqxhr);
      alertify.error(t('Failed to create import.'));
    });
  },
  dropFiles (files, params={}) {
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
  onActionButtonClick (evt) {
    var data = evt.actionIcon ? evt.actionIcon.dataset : evt.currentTarget.dataset;
    var assetType = data.assetType,
        action = data.action,
        // disabled = data.disabled === 'true',
        uid = stores.selectedAsset.uid,
        result;
    this.baseName = isLibrary(this.context.router) ? 'library-' : '';
    // var click = this.click;
    if (action === 'new') {
      result = this.click.asset.new.call(this);
    } else if (this.click[assetType] && this.click[assetType][action]) {
      result = this.click[assetType][action].call(this, uid, evt);
    }
    if (result !== false) {
      evt.preventDefault();
    }
  },
  click: {
    collection: {
      sharing: function(uid/*, evt*/){
        this.transitionTo('collection-sharing', {assetid: uid});
      },
      view: function(uid/*, evt*/){
        this.transitionTo('collection-page', {uid: uid});
      },
      delete: function(uid/*, evt*/){
        var q_ = t('Warning! You are about to delete this collection with all its questions and blocks. Are you sure you want to continue?');
        customConfirmAsync(q_)
          .done(function(){
            actions.resources.deleteCollection({uid: uid});
          });
      },
    },
    asset: {
      new: function(/*uid, evt*/){
        this.transitionTo('new-form');
      },
      view: function(uid/*, evt*/){
        this.transitionTo(`${this.baseName}form-landing`, {assetid: uid});
      },
      clone: function(uid/*, evt*/){
        customPromptAsync(t('new name?'))
          .then((value) => {
            actions.resources.cloneAsset({
              uid: uid,
              name: value,
            }, {
              onComplete: (asset) => {
                this.refreshSearch && this.refreshSearch();
              }
            });
          });
      },
      download: function(uid/*, evt*/){
        this.transitionTo(`${this.baseName}form-download`, {assetid: uid});
      },
      edit: function (uid) {
        this.transitionTo(`${this.baseName}form-edit`, {assetid: uid});
      },
      delete: function(uid/*, evt*/){
        let asset = stores.selectedAsset.asset;
        let dialog = alertify.dialog('confirm');
        let deployed = asset.has_deployment;
        let msg, onshow;
        let onok = (evt, val) => {
          actions.resources.deleteAsset({uid: uid}, {
            onComplete: ()=> {
              this.refreshSearch && this.refreshSearch();
              $('.alertify-toggle input').prop("checked", false);
            }
          });
        };

        if (!deployed) {
          msg = t('You are about to permanently delete this draft.');
        } else {
          msg = `
            ${t('You are about to permanently delete this form.')}
            <label class="alertify-toggle"><input type="checkbox"/> ${t('All data gathered for this form will be deleted.')}</label>
            <label class="alertify-toggle"><input type="checkbox"/> ${t('All questions created for this form will be deleted.')}</label>
            <label class="alertify-toggle"><input type="checkbox"/> ${t('The form associated with this project will be deleted.')}</label>
            <label class="alertify-toggle alertify-toggle-important"><input type="checkbox" /> ${t('I understand that if I delete this project I will not be able to recover it.')}</label>
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
          title: t('Delete Project'),
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
        dmix.deployAsset(asset, () => {
          // this callback is a kludge and here because I can't figure out how
          // to call `transitionTo()` from within `deployAsset()`
          this.transitionTo(`${this.baseName}form-landing`, {assetid: uid});
        });
      },
      archive: function(uid, evt) {
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
        this.transitionTo(`${this.baseName}form-sharing`, {assetid: uid});
      },

    }
  },
};
 
export default mixins;
