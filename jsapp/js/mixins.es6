/*eslint no-unused-vars:0*/
import React from 'react/addons';
import Reflux from 'reflux';
import Dropzone from './libs/dropzone';
import Select from 'react-select';
import alertify from 'alertifyjs';
import {Link, Navigation} from 'react-router';
import mdl from './libs/rest_framework/material';
import TagsInput from 'react-tagsinput';
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
  customConfirm,
  customConfirmAsync,
  customPromptAsync,
  log,
  t,
  assign,
  notify,
  isLibrary,
  stringToColor
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
        stores.pageState.showModal({
          type: 'sharing', 
          assetid: uid
        });

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

var UserPermDiv = React.createClass({
  mixins: [
    Navigation,
    mixins.permissions,
  ],
  PermOnChange(permName) {
    var cans = this.props.can;
    if (permName != '') {
      this.setPerm(permName, this.props);
      if (permName == 'view' && cans.change)
        this.removePerm('change', cans.change, this.props.uid);
    } else {
      if (cans.view)
        this.removePerm('view', cans.view, this.props.uid);
      if (cans.change)
        this.removePerm('change', cans.change, this.props.uid);
    }

  },
  render () {
    var initialsStyle = {
      background: `#${stringToColor(this.props.username)}`
    };

    var currentPerm = '';
    var cans = this.props.can;

    if (cans.change) {
      var currentPerm = 'change';
    } else if (cans.view) {
      var currentPerm = 'view';
    }

    var availablePermissions = [
      {value: 'view', label: t('Can View')},
      {value: 'change', label: t('Can Edit')}
    ];

    return (
      <bem.UserRow m={cans.view || cans.change ? 'regular' : 'deleted'}>
        <bem.UserRow__avatar>
          <bem.AccountBox__initials style={initialsStyle}>
            {this.props.username.charAt(0)}
          </bem.AccountBox__initials>
        </bem.UserRow__avatar>
        <bem.UserRow__name>
          {this.props.username}
          {/*<div><UserProfileLink username= /></div>*/}
        </bem.UserRow__name>
        <bem.UserRow__role>
          <Select
            name='userPerms'
            value={currentPerm}
            clearable={true}
            options={availablePermissions}
            onChange={this.PermOnChange}
          />
        </bem.UserRow__role>
      </bem.UserRow>      
      );
  }
});

var PublicPermDiv = React.createClass({
  mixins: [
    Navigation,
    mixins.permissions
  ],
  togglePerms() {
    if (this.props.publicPerm)
      this.removePerm('view',this.props.publicPerm, this.props.uid);
    else
      this.setPerm('view', {
          username: anonUsername,
          uid: this.props.uid,
          kind: this.props.kind,
          objectUrl: this.props.objectUrl
        }
      );
  },
  render () {
    var uid = this.props.uid;

    switch (this.props.kind) {
      case 'collection':
        var href = this.makeHref('collection-page', {uid: uid});
      break;
      default: 
        var href = this.makeHref('form-landing', {assetid: uid});
    }

    if (isLibrary(this.context.router))
      href = this.makeHref('library-form-landing', {assetid: uid});

    var url = `${window.location.protocol}//${window.location.host}/${href}`;

    return (
      <bem.FormModal__item m='perms-link'>
          <input type="checkbox" checked={this.props.publicPerm ? true : false} onChange={this.togglePerms} />
        <label className="long next-to-checkbox">
          {t('Share by link')}
        </label>
        { this.props.publicPerm && 
          <bem.FormModal__item>
            <label>
              {t('Shareable link')}
            </label>
            <input type="text" value={url} readOnly />
          </bem.FormModal__item>
        }
      </bem.FormModal__item>
    );
  }
});

mixins.shareAsset = {
  mixins: [
    mixins.permissions,
    Reflux.connectFilter(stores.asset, function(data){
      var uid = this.props.params.assetid,
        asset = data[uid];
      if (asset) {
        return {
          asset: asset,
          permissions: asset.permissions,
          owner: asset.owner__username,
          pperms: parsePermissions(asset.owner__username, asset.permissions),
          public_permission: getAnonymousUserPermission(asset.permissions),
          related_users: stores.asset.relatedUsers[uid]
        };
      }
    })
  ],
  componentDidMount () {
    this.listenTo(stores.userExists, this.userExistsStoreChange);
  },
  userExistsStoreChange (checked, result) {
    var inpVal = this.usernameFieldValue();
    if (inpVal === result) {
      var newStatus = checked[result] ? 'success' : 'error';
      this.setState({
        userInputStatus: newStatus
      });
    }
  },
  usernameField () {
    return this.refs.usernameInput.getDOMNode();
  },
  usernameFieldValue () {
    return this.usernameField().value;
  },
  usernameCheck (evt) {
    var username = evt.target.value;
    if (username && username.length > 3) {
      var result = stores.userExists.checkUsername(username);
      if (result === undefined) {
        actions.misc.checkUsername(username);
      } else {
        log(result ? 'success' : 'error');
        this.setState({
          userInputStatus: result ? 'success' : 'error'
        });
      }
    } else {
      this.setState({
        userInputStatus: false
      });
    }
  },
  getInitialState () {
    return {
      userInputStatus: false
    };
  },
  addInitialUserPermission (evt) {
    evt.preventDefault();
    var username = this.usernameFieldValue();
    if (stores.userExists.checkUsername(username)) {
      actions.permissions.assignPerm({
        username: username,
        uid: this.props.params.assetid,
        kind: this.state.asset.kind,
        objectUrl: this.props.objectUrl,
        role: 'view'
      });
      this.usernameField().value = '';
    }
  },
  sharingForm () {
    var inpStatus = this.state.userInputStatus;
    if (!this.state.pperms) {
      return (
          <i className="fa fa-spin" />
        );
    }
    var _perms = this.state.pperms;
    var perms = this.state.related_users.map(function(username){
      var currentPerm = _perms.filter(function(p){
        return p.username === username;
      })[0];
      if (currentPerm) {
        return currentPerm;
      } else {
        return {
          username: username,
          can: {}
        };
      }
    });
    var btnKls = classNames('mdl-button','mdl-js-button','mdl-button--raised','mdl-button--colored', 
                            inpStatus === 'success' ? 'mdl-button--colored' : 'hidden');

    var uid = this.state.asset.uid;
    var kind = this.state.asset.kind;
    var asset_type = this.state.asset.asset_type;
    var objectUrl = this.state.asset.url;

    if (!perms) {
      return (
          <p>loading</p>
        );
    }

    var initialsStyle = {
      background: `#${stringToColor(this.state.asset.owner__username)}`
    };

    return (
      <bem.FormModal>
        <bem.FormModal__item>
          <bem.FormView__cell m='label'>
            {t('Who has access')}
          </bem.FormView__cell>
          <bem.UserRow>
            <bem.UserRow__avatar>
              <bem.AccountBox__initials style={initialsStyle}>
                {this.state.asset.owner__username.charAt(0)}
              </bem.AccountBox__initials>
            </bem.UserRow__avatar>
            <bem.UserRow__name>
              <div>{this.state.asset.owner__username}</div>
            </bem.UserRow__name>
            <bem.UserRow__role>{t('is owner')}</bem.UserRow__role>
          </bem.UserRow>

          {perms.map((perm)=> {
            return <UserPermDiv key={`perm.${uid}.${perm.username}`} ref={perm.username} uid={uid} kind={kind} objectUrl={objectUrl} {...perm} />;
          })}

        </bem.FormModal__item>

        <bem.FormModal__form onSubmit={this.addInitialUserPermission} className="sharing-form__user">
          <bem.FormModal__item m='perms-user'>
            <bem.FormView__cell m='label'>
              {t('Invite collaborators')}
            </bem.FormView__cell>
            <input type="text"
                id="permsUser" 
                ref='usernameInput'
                placeholder={t('Enter a username')}
                onKeyUp={this.usernameCheck}
            />
            <button className={btnKls}>
              <i className="fa fa-fw fa-lg fa-plus" />
            </button>
          </bem.FormModal__item>
        </bem.FormModal__form>

        { kind != 'collection' && asset_type == 'survey' && 
          <bem.FormView__cell>
            <bem.FormView__cell m='label'>
              {t('Select share settings')}
            </bem.FormView__cell>
            <PublicPermDiv 
              uid={uid}
              publicPerm={this.state.public_permission}
              kind={kind}
              objectUrl={objectUrl}
            />
          </bem.FormView__cell>
        }
      </bem.FormModal>
    );
  }
};

 
export default mixins;
