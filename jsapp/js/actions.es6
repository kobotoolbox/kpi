import alertify from 'alertifyjs';
import {dataInterface} from './dataInterface';
import {
  log,
  t,
  notify,
  replaceSupportEmail,
} from './utils';

var Reflux = require('reflux');
import RefluxPromise from './libs/reflux-promise';
Reflux.use(RefluxPromise(window.Promise));

var actions = {};


actions.navigation = Reflux.createActions([
    'transitionStart',
    'transitionEnd',
    'routeUpdate',
    'documentTitleUpdate'
  ]);

actions.auth = Reflux.createActions({
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
  collections: {
    children: [
      'completed',
      'failed'
    ]
  }
});

actions.resources = Reflux.createActions({
  listCollections: {
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

actions.resources.updateAsset.listen(function(uid, values, params={}) {
  dataInterface.patchAsset(uid, values)
    .done((asset) => {
      actions.resources.updateAsset.completed(asset, uid, values);
      if (typeof params.onComplete === 'function') {
        params.onComplete(asset, uid, values);
      }
      notify(t('successfully updated'));
    })
    .fail(function(resp){
      actions.resources.updateAsset.failed(resp);
    });
});

actions.resources.deployAsset.listen(function(asset, redeployment, params={}){
  dataInterface.deployAsset(asset, redeployment)
    .done((data) => {
      actions.resources.deployAsset.completed(data.asset);
      if (typeof params.onDone === 'function') {
        params.onDone(data, redeployment);
      }
    })
    .fail((data) => {
      actions.resources.deployAsset.failed(data, redeployment);
      if (typeof params.onFail === 'function') {
        params.onFail(data,  redeployment);
      }
    });
});

actions.resources.deployAsset.failed.listen(function(data, redeployment){
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

actions.resources.setDeploymentActive.listen(function(details) {
  dataInterface.setDeploymentActive(details)
    .done((data) => {
      actions.resources.setDeploymentActive.completed(data.asset);
    })
    .fail(actions.resources.setDeploymentActive.failed);
});
actions.resources.setDeploymentActive.completed.listen((result) => {
  if (result.active) {
    notify(t('Project unarchived successfully'));
  } else {
    notify(t('Project archived successfully'));
  }
});

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
  dataInterface.deleteAsset(details)
    .done(() => {
      actions.resources.deleteAsset.completed(details);
      if (typeof params.onComplete === 'function') {
        params.onComplete(details);
      }
    })
    .fail((err) => {
      actions.resources.deleteAsset.failed(details);
      alertify.alert(
        t('Unable to delete asset!'),
        `<p>${t('Error details:')}</p><pre style='max-height: 200px;'>${err.responseText}</pre>`
      );
    });
});

actions.resources.deleteCollection.listen(function(details, params = {}){
  dataInterface.deleteCollection(details)
    .done(function(result) {
      actions.resources.deleteCollection.completed(details, result);
      if (typeof params.onComplete === 'function') {
        params.onComplete(details, result);
      }
    })
    .fail(actions.resources.deleteCollection.failed);
});
actions.resources.deleteCollection.failed.listen(() => {
  notify(t('Failed to delete collection.'), 'error');
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

actions.resources.cloneAsset.listen(function(details, params={}){
  dataInterface.cloneAsset(details)
    .done((asset) => {
      actions.resources.cloneAsset.completed(asset);
      if (typeof params.onComplete === 'function') {
        params.onComplete(asset);
      }
    })
    .fail(actions.resources.cloneAsset.failed);
});

actions.search.assets.listen(function(searchData, params={}){
  dataInterface.searchAssets(searchData)
    .done(function(response){
      actions.search.assets.completed(searchData, response);
      if (typeof params.onComplete === 'function') {
        params.onComplete(searchData, response);
      }
    })
    .fail(function(response){
      actions.search.assets.failed(searchData, response);
      if (typeof params.onFailed === 'function') {
        params.onFailed(searchData, response);
      }
    });
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

actions.resources.loadAssetContent.listen(function(params){
  dataInterface.getAssetContent(params)
    .done(actions.resources.loadAssetContent.completed)
    .fail(actions.resources.loadAssetContent.failed);
});

actions.resources.listCollections.listen(function(){
  dataInterface.listCollections()
    .done(actions.resources.listCollections.completed)
    .fail(actions.resources.listCollections.failed);
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
