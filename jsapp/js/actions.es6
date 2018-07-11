import alertify from 'alertifyjs';
import {dataInterface} from './dataInterface';
import {
  log,
  t,
  notify,
  replaceSupportEmail,
} from './utils';

var Reflux = require('reflux');
import RefluxPromise from "./libs/reflux-promise";
Reflux.use(RefluxPromise(window.Promise));

var actions = {};


actions.navigation = Reflux.createActions([
    'transitionStart',
    'transitionEnd',
    'historyPush',
    'routeUpdate',

    'documentTitleUpdate'
  ]);

actions.auth = Reflux.createActions({
  login: {
    children: [
      'loggedin',
      'passwordfail',
      'anonymous',
      'failed'
    ]
  },
  verifyLogin: {
    children: [
      'loggedin',
      'anonymous',
      'failed'
    ]
  },
  logout: {
    children: [
      'completed',
      'failed'
    ]
  },
  changePassword: {
    children: [
      'completed',
      'failed'
    ]
  },
  getEnvironment: {
    children: [
      'completed',
      'failed'
    ]
  },
});

actions.survey = Reflux.createActions({
  addItemAtPosition: {
    children: [
      'completed',
      'failed'
    ],
  }
});

actions.search = Reflux.createActions({
  assets: {
    children: [
      'completed',
      'failed'
    ]
  },
  assetsWithTags: {
    children: [
      'completed',
      'failed'
    ]
  },
  tags: {
    children: [
      'completed',
      'failed'
    ]
  },
  libraryDefaultQuery: {
    children: [
      'completed',
      'failed'
    ]
  },
  collections: {
    children: [
      'completed',
      'failed'
    ]
  }
});

actions.resources = Reflux.createActions({
  listAssets: {
    children: [
      'completed',
      'failed'
    ]
  },
  listSurveys: {
    children: [
      'completed',
      'failed'
    ]
  },
  listCollections: {
    children: [
      'completed',
      'failed'
    ]
  },
  listQuestionsAndBlocks: {
    children: [
      'completed',
      'failed'
    ]
  },
  createAsset: {
    children: [
      'completed',
      'failed'
    ]
  },
  createImport: {
    children: [
      'completed',
      'failed'
    ]
  },
  loadAsset: {
    children: [
      'completed',
      'failed'
    ]
  },
  deployAsset: {
    children: [
      'completed',
      'failed'
    ]
  },
  setDeploymentActive: {
    children: [
      'completed',
      'failed'
    ]
  },
  createSnapshot: {
    children: [
      'completed',
      'failed'
    ]
  },
  cloneAsset: {
    children: [
      'completed',
      'failed'
    ]
  },
  deleteAsset: {
    children: [
      'completed',
      'failed'
    ]
  },
  listTags: {
    children: [
      'completed',
      'failed'
    ]
  },
  createCollection: {
    children: [
      'completed',
      'failed'
    ]
  },
  readCollection: {
    children: [
      'completed',
      'failed'
    ]
  },
  updateCollection: {
    asyncResult: true
  },
  deleteCollection: {
    children: [
      'completed',
      'failed'
    ]
  },
  loadAssetSubResource: {
    children: [
      'completed',
      'failed'
    ]
  },
  loadAssetContent: {
    children: [
      'completed',
      'failed'
    ]
  },
  loadResource: {
    children: [
      'completed',
      'failed'
    ],
  },
  createResource: {
    asyncResult: true
  },
  updateAsset: {
    asyncResult: true
  },
  updateSubmissionValidationStatus: {
    children: [
      'completed',
      'failed'
    ],
  },
  getAssetFiles: {
    children: [
      'completed',
      'failed'
    ],
  },
  notFound: {}
});

actions.permissions = Reflux.createActions({
  assignPerm: {
    children: [
      'completed',
      'failed'
    ]
  },
  removePerm: {
    children: [
      'completed',
      'failed'
    ]
  },
  copyPermissionsFrom: {
    children: [
      'completed',
      'failed'
    ]
  },
  assignPublicPerm: {
    children: [
      'completed',
      'failed'
    ]
  },
  setCollectionDiscoverability: {
    children: [
      'completed',
      'failed'
    ]
  },
});

actions.misc = Reflux.createActions({
  checkUsername: {
    asyncResult: true,
    children: [
      'completed',
      'failed_'
    ]
  },
  updateProfile: {
    children: [
      'completed',
      'failed'
    ]
  },
  getServerEnvironment: {
    children: [
      'completed',
      'failed',
    ]
  },
});


actions.misc.checkUsername.listen(function(username){
  dataInterface.queryUserExistence(username)
    .done(actions.misc.checkUsername.completed)
    .fail(actions.misc.checkUsername.failed_);
});

actions.misc.updateProfile.listen(function(data, callbacks={}){
  dataInterface.patchProfile(data)
    .done((...args) => {
      actions.misc.updateProfile.completed(...args)
      if (callbacks.onComplete) {
        callbacks.onComplete(...args);
      }
    })
    .fail((...args) => {
      actions.misc.updateProfile.failed(...args)
      if (callbacks.onFail) {
        callbacks.onFail(...args);
      }
    });
});
actions.misc.updateProfile.completed.listen(function(){
  notify(t('updated profile successfully'));
});
actions.misc.updateProfile.failed.listen(function(data) {
  let hadFieldsErrors = false;
  for (const [errorProp, errorValue] of Object.entries(data.responseJSON)){
    if (errorProp !== 'non_fields_error') {
      hadFieldsErrors = true;
    }
  }

  if (hadFieldsErrors) {
    notify(t('Some fields contain errors'), 'error');
  } else {
    notify(t('failed to update profile'), 'error');
  }
});

actions.misc.getServerEnvironment.listen(function(){
  dataInterface.serverEnvironment()
    .done(actions.misc.getServerEnvironment.completed)
    .fail(actions.misc.getServerEnvironment.failed);
});

actions.resources.createImport.listen(function(contents){
  if (contents.base64Encoded) {
    dataInterface.postCreateImport(contents)
      .done(actions.resources.createImport.completed)
      .fail(actions.resources.createImport.failed);
  } else if (contents.content) {
    dataInterface.createResource(contents);
  }
});

actions.resources.createImport.completed.listen(function(contents){
  if (contents.status) {
    if(contents.status === 'processing') {
      notify(t('successfully uploaded file; processing may take a few minutes'));
      log('processing import ' + contents.uid, contents);
    } else {
      notify(`unexpected import status ${contents.status}`, 'error');
    }
  } else {
    notify(t('Error: import.status not available'));
  }
});

actions.resources.createAsset.listen(function(){
  console.error(`use actions.resources.createImport
                  or actions.resources.createResource.`);
});

actions.resources.createResource.failed.listen(function(){
  log('createResourceFailed');
});

actions.resources.createSnapshot.listen(function(details){
  dataInterface.createAssetSnapshot(details)
    .done(actions.resources.createSnapshot.completed)
    .fail(actions.resources.createSnapshot.failed);
});

actions.resources.listTags.listen(function(data){
  dataInterface.listTags(data)
    .done(actions.resources.listTags.completed)
    .fail(actions.resources.listTags.failed);
});

actions.resources.listTags.completed.listen(function(results){
  if (results.next && window.Raven) {
    Raven.captureMessage('MAX_TAGS_EXCEEDED: Too many tags');
  }
});

actions.resources.updateAsset.listen(function(uid, values){
  dataInterface.patchAsset(uid, values)
    .done(function(asset){
      actions.resources.updateAsset.completed(asset);
      notify(t('successfully updated'));
    })
    .fail(function(resp){
      actions.resources.updateAsset.failed(resp);
    });
});

actions.resources.deployAsset.listen(
  function(asset, redeployment, dialog_or_alert, params={}){
    var onComplete;
    if (params && params.onComplete) {
      onComplete = params.onComplete;
    }
    dataInterface.deployAsset(asset, redeployment)
      .done((data) => {
        actions.resources.deployAsset.completed(data, dialog_or_alert);
        if (onComplete) {
          onComplete(asset);
        }
      })
      .fail((data) => {
        actions.resources.deployAsset.failed(data, dialog_or_alert);
      });
  }
);

actions.resources.deployAsset.completed.listen(function(data, dialog_or_alert){
  // close the dialog/alert.
  // (this was sometimes failing. possibly dialog already destroyed?)
  if (dialog_or_alert) {
    if (typeof dialog_or_alert.destroy === 'function') {
        dialog_or_alert.destroy();
    } else if (typeof dialog_or_alert.dismiss === 'function') {
        dialog_or_alert.dismiss();
    }
  }
});

actions.resources.deployAsset.failed.listen(function(data, dialog_or_alert){
  // close the dialog/alert.
  // (this was sometimes failing. possibly dialog already destroyed?)
  if (dialog_or_alert) {
    if (typeof dialog_or_alert.destroy === 'function') {
        dialog_or_alert.destroy();
    } else if (typeof dialog_or_alert.dismiss === 'function') {
        dialog_or_alert.dismiss();
    }
  }
  // report the problem to the user
  let failure_message = null;

  if(!data.responseJSON || (!data.responseJSON.xform_id_string &&
                            !data.responseJSON.detail)) {
    // failed to retrieve a valid response from the server
    // setContent() removes the input box, but the value is retained
    var msg;
    if (data.status == 500 && data.responseJSON && data.responseJSON.error) {
      msg = `<pre>${data.responseJSON.error}</pre>`;
    } else if (data.status == 500 && data.responseText) {
      msg = `<pre>${data.responseText}</pre>`;
    } else {
      msg = t('please check your connection and try again.');
    }
    failure_message = `
      <p>${replaceSupportEmail(t('if this problem persists, contact help@kobotoolbox.org'))}</p>
      <p>${msg}</p>
    `;
  } else if(!!data.responseJSON.xform_id_string){
    // TODO: now that the id_string is automatically generated, this failure
    // mode probably doesn't need special handling
    failure_message = `
      <p>${t('your form id was not valid:')}</p>
      <p><pre>${data.responseJSON.xform_id_string}</pre></p>
      <p>${replaceSupportEmail(t('if this problem persists, contact help@kobotoolbox.org'))}</p>
    `;
  } else if(!!data.responseJSON.detail) {
    failure_message = `
      <p>${t('your form cannot be deployed because it contains errors:')}</p>
      <p><pre>${data.responseJSON.detail}</pre></p>
    `;
  }
  alertify.alert(t('unable to deploy'), failure_message);
});

actions.resources.setDeploymentActive.listen(
  function(details, params={}) {
    var onComplete;
    if (params && params.onComplete) {
      onComplete = params.onComplete;
    }
    dataInterface.setDeploymentActive(details)
      .done(function(/*result*/){
        actions.resources.setDeploymentActive.completed(details);
        if (onComplete) {
          onComplete(details);
        }
      })
      .fail(actions.resources.setDeploymentActive.failed);
  }
);

actions.resources.getAssetFiles.listen(function(assetId) {
  dataInterface
    .getAssetFiles(assetId)
    .done(actions.resources.getAssetFiles.completed)
    .fail(actions.resources.getAssetFiles.failed);
});


actions.reports = Reflux.createActions({
  setStyle: {
    children: [
      'completed',
      'failed',
    ]
  },
  setCustom: {
    children: [
      'completed',
      'failed',
    ]
  }
});

actions.reports.setStyle.listen(function(assetId, details){
  dataInterface.patchAsset(assetId, {
    report_styles: JSON.stringify(details),
  }).done(actions.reports.setStyle.completed)
    .fail(actions.reports.setStyle.failed);
});

actions.reports.setCustom.listen(function(assetId, details){
  dataInterface.patchAsset(assetId, {
    report_custom: JSON.stringify(details),
  }).done(actions.reports.setCustom.completed)
    .fail(actions.reports.setCustom.failed);
});

actions.table = Reflux.createActions({
  updateSettings: {
    children: [
      'completed',
      'failed',
    ]
  }
});

actions.table.updateSettings.listen(function(assetId, settings){
  dataInterface.patchAsset(assetId, {
    settings: JSON.stringify(settings),
  }).done(actions.table.updateSettings.completed)
    .fail(actions.table.updateSettings.failed);
});


actions.map = Reflux.createActions({
  setMapSettings: {
    children: ['completed', 'failed']
  }
});

actions.map.setMapSettings.listen(function(assetId, details) {
  dataInterface
    .patchAsset(assetId, {
      map_styles: JSON.stringify(details)
    })
    .done(actions.map.setMapSettings.completed)
    .fail(actions.map.setMapSettings.failed);
});


actions.resources.createResource.listen(function(details){
  dataInterface.createResource(details)
    .done(function(asset){
      actions.resources.createResource.completed(asset);
    })
    .fail(function(...args){
      actions.resources.createResource.failed(...args)
    });
});

actions.resources.deleteAsset.listen(function(details, params={}){
  var onComplete;
  if (params && params.onComplete) {
    onComplete = params.onComplete;
  }
  dataInterface.deleteAsset(details)
    .done(function(/*result*/){
      actions.resources.deleteAsset.completed(details);
      if (onComplete) {
        onComplete(details);
      }
    })
    .fail(actions.resources.deleteAsset.failed);
});

actions.resources.readCollection.listen(function(details){
  dataInterface.readCollection(details)
      .done(actions.resources.readCollection.completed)
      .fail(function(req, err, message){
        actions.resources.readCollection.failed(details, req, err, message);
      });
});

actions.resources.deleteCollection.listen(function(details){
  dataInterface.deleteCollection(details)
    .done(function(result){
      actions.resources.deleteCollection.completed(details, result);
    })
    .fail(actions.resources.deleteCollection.failed);
});

actions.resources.updateCollection.listen(function(uid, values){
  dataInterface.patchCollection(uid, values)
    .done(function(asset){
      actions.resources.updateCollection.completed(asset);
      notify(t('successfully updated'));
    })
    .fail(function(...args){
      actions.resources.updateCollection.failed(...args);
    });
});

actions.resources.cloneAsset.listen(function(details, opts={}){
  dataInterface.cloneAsset(details)
    .done(function(...args){
      actions.resources.createAsset.completed(...args);
      actions.resources.cloneAsset.completed(...args);
      if (opts.onComplete) {
        opts.onComplete(...args);
      }
    })
    .fail(actions.resources.cloneAsset.failed);
});

actions.search.assets.listen(function(queryString){
  dataInterface.searchAssets(queryString)
    .done(function(...args){
      actions.search.assets.completed.apply(this, [queryString, ...args]);
    })
    .fail(function(...args){
      actions.search.assets.failed.apply(this, [queryString, ...args]);
    });
});

actions.search.libraryDefaultQuery.listen(function(){
  dataInterface.libraryDefaultSearch()
    .done(actions.search.libraryDefaultQuery.completed)
    .fail(actions.search.libraryDefaultQuery.failed);
});

actions.search.assetsWithTags.listen(function(queryString){
  dataInterface.assetSearch(queryString)
    .done(actions.search.assetsWithTags.completed)
    .fail(actions.search.assetsWithTags.failed);
});

actions.search.tags.listen(function(queryString){
  dataInterface.searchTags(queryString)
    .done(actions.search.searchTags.completed)
    .fail(actions.search.searchTags.failed);
});

actions.permissions.assignPerm.listen(function(creds){
  dataInterface.assignPerm(creds)
    .done(actions.permissions.assignPerm.completed)
    .fail(actions.permissions.assignPerm.failed);
});
actions.permissions.assignPerm.completed.listen(function(val){
  actions.resources.loadAsset({url: val.content_object});
});

// copies permissions from one asset to other
actions.permissions.copyPermissionsFrom.listen(function(sourceUid, targetUid) {
  dataInterface.copyPermissionsFrom(sourceUid, targetUid)
    .done((response) => {
      actions.resources.loadAsset({id: targetUid});
      actions.permissions.copyPermissionsFrom.completed();
    })
    .fail(actions.permissions.copyPermissionsFrom.failed);
});

actions.permissions.removePerm.listen(function(details){
  if (!details.content_object_uid) {
    throw new Error('removePerm needs a content_object_uid parameter to be set');
  }
  dataInterface.removePerm(details.permission_url)
    .done(function(resp){
      actions.permissions.removePerm.completed(details.content_object_uid, resp);
    })
    .fail(actions.permissions.removePerm.failed);
});

actions.permissions.removePerm.completed.listen(function(uid){
  actions.resources.loadAsset({id: uid});
});

actions.permissions.setCollectionDiscoverability.listen(function(uid, discoverable){
  dataInterface.patchCollection(uid, {discoverable_when_public: discoverable})
    .done(actions.permissions.setCollectionDiscoverability.completed)
    .fail(actions.permissions.setCollectionDiscoverability.failed);
});
actions.permissions.setCollectionDiscoverability.completed.listen(function(val){
  actions.resources.loadAsset({url: val.url});
});

actions.auth.login.listen(function(creds){
  dataInterface.login(creds).done(function(resp1){
    dataInterface.selfProfile().done(function(data){
        if(data.username) {
          actions.auth.login.loggedin(data);
        } else {
          actions.auth.login.passwordfail(resp1);
        }
      }).fail(actions.auth.login.failed);
  })
    .fail(actions.auth.login.failed);
});

// reload so a new csrf token is issued
actions.auth.logout.completed.listen(function(){
  window.setTimeout(function(){
    window.location.replace('', '');
  }, 1);
});

actions.auth.logout.listen(function(){
  dataInterface.logout().done(actions.auth.logout.completed).fail(function(){
    console.error('logout failed for some reason. what should happen now?');
  });
});
actions.auth.verifyLogin.listen(function(){
    dataInterface.selfProfile()
        .done((data/*, msg, req*/)=>{
          if (data.username) {
            actions.auth.verifyLogin.loggedin(data);
          } else {
            actions.auth.verifyLogin.anonymous(data);
          }
        })
        .fail(actions.auth.verifyLogin.failed);
});

actions.auth.changePassword.listen((currentPassword, newPassword) => {
  dataInterface.patchProfile({
    current_password: currentPassword,
    new_password: newPassword
  })
  .done(actions.auth.changePassword.completed)
  .fail(actions.auth.changePassword.failed);
});
actions.auth.changePassword.completed.listen(() => {
  notify(t('changed password successfully'));
});
actions.auth.changePassword.failed.listen(() => {
  notify(t('failed to change password'), 'error');
});

actions.auth.getEnvironment.listen(function(){
  dataInterface.environment()
    .done((data)=>{
      actions.auth.getEnvironment.completed(data);
    })
    .fail(actions.auth.getEnvironment.failed);
});
actions.auth.getEnvironment.failed.listen(() => {
  notify(t('failed to load environment data'), 'error');
});


actions.resources.loadAsset.listen(function(params){
  var dispatchMethodName;
  if (params.url) {
    dispatchMethodName = params.url.indexOf('collections') === -1 ?
        'getAsset' : 'getCollection';
  } else {
    dispatchMethodName = {
      c: 'getCollection',
      a: 'getAsset'
    }[params.id[0]];
  }

  dataInterface[dispatchMethodName](params)
      .done(actions.resources.loadAsset.completed)
      .fail(actions.resources.loadAsset.failed);
});

actions.resources.loadAsset.completed.listen(function(asset){
  actions.navigation.historyPush(asset);
});

actions.resources.loadAssetContent.listen(function(params){
  dataInterface.getAssetContent(params)
      .done(function(data, ...args) {
        // data.sheeted = new Sheeted([['survey', 'choices', 'settings'], data.data])
        actions.resources.loadAssetContent.completed(data, ...args);
      })
      .fail(actions.resources.loadAssetContent.failed);
});

actions.resources.listAssets.listen(function(){
  dataInterface.listAllAssets()
      .done(actions.resources.listAssets.completed)
      .fail(actions.resources.listAssets.failed);
});

actions.resources.listSurveys.listen(function(){
  dataInterface.listSurveys()
      .done(actions.resources.listAssets.completed)
      .fail(actions.resources.listAssets.failed);
});

actions.resources.listCollections.listen(function(){
  dataInterface.listCollections()
      .done(actions.resources.listCollections.completed)
      .fail(actions.resources.listCollections.failed);
});

actions.resources.listQuestionsAndBlocks.listen(function(){
  dataInterface.listQuestionsAndBlocks()
      .done(actions.resources.listAssets.completed)
      .fail(actions.resources.listAssets.failed);
});

actions.resources.updateSubmissionValidationStatus.listen(function(uid, sid, data){
  dataInterface.updateSubmissionValidationStatus(uid, sid, data).done((result) => {
    actions.resources.updateSubmissionValidationStatus.completed(result, sid);
  }).fail((error)=>{
    console.error(error);
    actions.resources.updateSubmissionValidationStatus.failed(error);
  });
});

module.exports = actions;
