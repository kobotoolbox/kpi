/**
 * A bundle file for all Reflux actions. This is the only place that React
 * components should be talking to Backend.
 *
 * You can observe action result through Reflux callbacks in your component, or
 * more preferably (where applicable) use the update eveont of one of the stores
 * from `jsapp/js/stores.es6`
 *
 * TODO: Group and split actions to separate files. For a working example see `./actions/help`.
 */

import alertify from 'alertifyjs';
import Reflux from 'reflux';
import RefluxPromise from './libs/reflux-promise';
import {dataInterface} from './dataInterface';
import {permissionsActions} from './actions/permissions';
import {helpActions} from './actions/help';
import libraryActions from './actions/library';
import submissionsActions from './actions/submissions';
import formMediaActions from './actions/mediaActions';
import exportsActions from './actions/exportsActions';
import dataShareActions from './actions/dataShareActions';
import {
  notify,
  replaceSupportEmail,
} from 'utils';

// Configure Reflux
Reflux.use(RefluxPromise(window.Promise));

export const actions = {
  permissions: permissionsActions,
  help: helpActions,
  library: libraryActions,
  submissions: submissionsActions,
  media: formMediaActions,
  exports: exportsActions,
  dataShare: dataShareActions,
};

actions.navigation = Reflux.createActions([
  'transitionStart',
  'transitionEnd',
  'routeUpdate',
  'documentTitleUpdate'
]);

actions.auth = Reflux.createActions({
  verifyLogin: {children: ['loggedin', 'anonymous', 'failed']},
  logout: {children: ['completed', 'failed']},
  changePassword: {children: ['completed', 'failed']},
  getEnvironment: {children: ['completed', 'failed']},
  getApiToken: {children: ['completed', 'failed']},
});

actions.survey = Reflux.createActions({
  addExternalItemAtPosition: {children: ['completed', 'failed']}
});

actions.search = Reflux.createActions({
  assets: {children: ['completed', 'failed']}
});

actions.resources = Reflux.createActions({
  createImport: {children: ['completed', 'failed']},
  loadAsset: {children: ['completed', 'failed']},
  deployAsset: {children: ['completed', 'failed']},
  setDeploymentActive: {children: ['completed', 'failed']},
  createSnapshot: {children: ['completed', 'failed']},
  cloneAsset: {children: ['completed', 'failed']},
  deleteAsset: {children: ['completed', 'failed']},
  listTags: {children: ['completed', 'failed']},
  loadAssetSubResource: {children: ['completed', 'failed']},
  createResource: {asyncResult: true},
  updateAsset: {asyncResult: true},
  updateSubmissionValidationStatus: {children: ['completed', 'failed']},
  removeSubmissionValidationStatus: {children: ['completed', 'failed']},
  deleteSubmission: {children: ['completed', 'failed']},
  duplicateSubmission: {children: ['completed', 'failed',]},
  refreshTableSubmissions: {children: ['completed', 'failed',]},
  getAssetFiles: {children: ['completed', 'failed']},
  notFound: {}
});

actions.hooks = Reflux.createActions({
  getAll: {children: ['completed', 'failed']},
  add: {children: ['completed', 'failed']},
  update: {children: ['completed', 'failed']},
  delete: {children: ['completed', 'failed']},
  getLogs: {children: ['completed', 'failed']},
  retryLog: {children: ['completed', 'failed']},
  retryLogs: {children: ['completed', 'failed']},
});

actions.misc = Reflux.createActions({
  getUser: {children: ['completed', 'failed']},
  checkUsername: {asyncResult: true, children: ['completed', 'failed']},
  updateProfile: {children: ['completed', 'failed']},
});

// TODO move these callbacks to `actions/permissions.es6` after moving
// `actions.resources` to separate file (circular dependency issue)
permissionsActions.assignAssetPermission.failed.listen(() => {
  notify(t('Failed to update permissions'), 'error');
});
permissionsActions.removeAssetPermission.failed.listen(() => {
  notify(t('Failed to remove permissions'), 'error');
});
permissionsActions.bulkSetAssetPermissions.failed.listen(() => {
  notify(t('Failed to update permissions'), 'error');
});
permissionsActions.assignAssetPermission.completed.listen((uid) => {
  // needed to update publicShareSettings after enabling link sharing
  actions.resources.loadAsset({id: uid});
});
permissionsActions.copyPermissionsFrom.completed.listen((sourceUid, targetUid) => {
  actions.resources.loadAsset({id: targetUid});
});
permissionsActions.setAssetPublic.completed.listen((uid) => {
  actions.resources.loadAsset({id: uid});
});
permissionsActions.removeAssetPermission.completed.listen((uid, isNonOwner) => {
  // Avoid this call if a non-owner removed their own permissions as it will fail
  if (!isNonOwner) {
    // needed to update publicShareSettings after disabling link sharing
    actions.resources.loadAsset({id: uid});
  }
});

actions.misc.getUser.listen((userUrl) => {
  dataInterface.getUser(userUrl)
    .done(actions.misc.getUser.completed)
    .fail(actions.misc.getUser.failed);
});

actions.misc.checkUsername.listen(function(username){
  dataInterface.queryUserExistence(username)
    .done(actions.misc.checkUsername.completed)
    .fail(actions.misc.checkUsername.failed);
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

actions.resources.createImport.listen((params, onCompleted, onFailed) => {
  dataInterface.createImport(params)
    .done((response) => {
      actions.resources.createImport.completed(response);
      if (typeof onCompleted === 'function') {onCompleted(response);}
    })
    .fail((response) => {
      actions.resources.createImport.failed(response);
      if (typeof onFailed === 'function') {onFailed(response);}
    });
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
      actions.resources.updateAsset.completed(asset);
      if (typeof params.onComplete === 'function') {
        params.onComplete(asset, uid, values);
      }
      notify(t('successfully updated'));
    })
    .fail(function(resp){
      actions.resources.updateAsset.failed(resp);
      if (params.onFailed) {
        params.onFailed(resp);
      }
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
  if (result.deployment__active) {
    notify(t('Project unarchived successfully'));
  } else {
    notify(t('Project archived successfully'));
  }
});

actions.resources.getAssetFiles.listen(function(assetId, fileType) {
  dataInterface
    .getAssetFiles(assetId, fileType)
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
  dataInterface.patchAsset(assetId, {report_styles: JSON.stringify(details)})
    .done((asset) => {
      actions.reports.setStyle.completed(asset);
      actions.resources.updateAsset.completed(asset);
    })
    .fail(actions.reports.setStyle.failed);
});

actions.reports.setCustom.listen(function(assetId, details){
  dataInterface.patchAsset(assetId, {report_custom: JSON.stringify(details)})
    .done((asset) => {
      actions.reports.setCustom.completed(asset);
      actions.resources.updateAsset.completed(asset);
    })
    .fail(actions.reports.setCustom.failed);
});

actions.table = Reflux.createActions({
  updateSettings: {children: ['completed', 'failed']},
});

/**
 * @param {string} assetUid
 * @param {object} settings
 * @param {string[]} [settings.selected-columns]
 * @param {string} [settings.frozen-column]
 * @param {boolean} [settings.show-group-name]
 * @param {number} [settings.translation-index]
 * @param {boolean} [settings.show-hxl-tags]
 * @param {object} [settings.sort-by]
 * @param {string} [settings.sort-by.fieldId]
 * @param {string} [settings.sort-by.sortValue]
 */
actions.table.updateSettings.listen((assetUid, settings) => {
  dataInterface.patchAsset(assetUid, {settings: JSON.stringify(settings)})
    .done((asset) => {
      actions.table.updateSettings.completed(asset);
      actions.resources.updateAsset.completed(asset);
    })
    .fail(actions.table.updateSettings.failed);
});


actions.map = Reflux.createActions({
  setMapStyles: {
    children: ['started', 'completed', 'failed']
  }
});

/**
 * Note: `started` callback returns parameters with wich the action was called
 * @param {string} assetUid
 * @param {object} mapStyles
 */
actions.map.setMapStyles.listen(function(assetUid, mapStyles) {
  dataInterface.patchAsset(assetUid, {map_styles: JSON.stringify(mapStyles)})
    .done((asset) => {
      actions.map.setMapStyles.completed(asset);
      actions.resources.updateAsset.completed(asset);
    })
    .fail(actions.map.setMapStyles.failed);
  actions.map.setMapStyles.started(assetUid, mapStyles);
});


actions.resources.createResource.listen(function(details){
  dataInterface.createResource(details)
    .done(function(asset){
      actions.resources.createResource.completed(asset);
    })
    .fail(function(...args){
      actions.resources.createResource.failed(...args);
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
actions.resources.cloneAsset.failed.listen(() => {
  notify(t('Could not create project!'), 'error');
});

actions.search.assets.listen(function(searchData, params = {}){
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

actions.auth.getApiToken.listen(() => {
  dataInterface.apiToken()
    .done((response) => {
      actions.auth.getApiToken.completed(response.token);
    })
    .fail(actions.auth.getApiToken.failed);
});
actions.auth.getApiToken.failed.listen(() => {
  notify(t('failed to load API token'), 'error');
});

actions.resources.loadAsset.listen(function(params){
  dataInterface.getAsset(params)
    .done(actions.resources.loadAsset.completed)
    .fail(actions.resources.loadAsset.failed);
});

actions.resources.updateSubmissionValidationStatus.listen(function(uid, sid, data){
  dataInterface.updateSubmissionValidationStatus(uid, sid, data).done((result) => {
    actions.resources.updateSubmissionValidationStatus.completed(result, sid);
  }).fail((error)=>{
    console.error(error);
    actions.resources.updateSubmissionValidationStatus.failed(error);
  });
});

actions.resources.removeSubmissionValidationStatus.listen((uid, sid) => {
  dataInterface.removeSubmissionValidationStatus(uid, sid).done((result) => {
    actions.resources.removeSubmissionValidationStatus.completed(result, sid);
  }).fail((error)=>{
    console.error(error);
    actions.resources.removeSubmissionValidationStatus.failed(error);
  });
});

actions.resources.deleteSubmission.listen((uid, sid) => {
  dataInterface.deleteSubmission(uid, sid)
    .done(() => {
      notify(t('submission deleted'));
      actions.resources.deleteSubmission.completed();
      actions.resources.loadAsset({id: uid});
    })
    .fail(() => {
      alertify.error(t('failed to delete submission'));
      actions.resources.deleteSubmission.failed();
    });
});

actions.resources.duplicateSubmission.listen((uid, sid, duplicatedSubmission) => {
  dataInterface.duplicateSubmission(uid, sid)
    .done((response) => {
      notify(t('Successfully duplicated submission'));
      actions.resources.duplicateSubmission.completed(uid, response._id, duplicatedSubmission);
      actions.resources.loadAsset({id: uid});
    })
    .fail((response) => {
      alertify.error(t('Failed to duplicate submission'));
      actions.resources.duplicateSubmission.failed(response);
    });
});

actions.hooks.getAll.listen((assetUid, callbacks = {}) => {
  dataInterface.getHooks(assetUid)
    .done((...args) => {
      actions.hooks.getAll.completed(...args);
      if (typeof callbacks.onComplete === 'function') {
        callbacks.onComplete(...args);
      }
    })
    .fail((...args) => {
      actions.hooks.getAll.failed(...args);
      if (typeof callbacks.onFail === 'function') {
        callbacks.onFail(...args);
      }
    });
});

actions.hooks.add.listen((assetUid, data, callbacks = {}) => {
  dataInterface.addExternalService(assetUid, data)
    .done((...args) => {
      actions.hooks.getAll(assetUid);
      actions.hooks.add.completed(...args);
      if (typeof callbacks.onComplete === 'function') {
        callbacks.onComplete(...args);
      }
    })
    .fail((...args) => {
      actions.hooks.add.failed(...args);
      if (typeof callbacks.onFail === 'function') {
        callbacks.onFail(...args);
      }
    });
});
actions.hooks.add.completed.listen((response) => {
  notify(t('REST Service added successfully'));
});
actions.hooks.add.failed.listen((response) => {
  notify(t('Failed adding REST Service'), 'error');
});

actions.hooks.update.listen((assetUid, hookUid, data, callbacks = {}) => {
  dataInterface.updateExternalService(assetUid, hookUid, data)
    .done((...args) => {
      actions.hooks.getAll(assetUid);
      actions.hooks.update.completed(...args);
      if (typeof callbacks.onComplete === 'function') {
        callbacks.onComplete(...args);
      }
    })
    .fail((...args) => {
      actions.hooks.update.failed(...args);
      if (typeof callbacks.onFail === 'function') {
        callbacks.onFail(...args);
      }
    });
});
actions.hooks.update.completed.listen(() => {
  notify(t('REST Service updated successfully'));
});
actions.hooks.update.failed.listen(() => {
  alertify.error(t('Failed saving REST Service'));
});

actions.hooks.delete.listen((assetUid, hookUid, callbacks = {}) => {
  dataInterface.deleteExternalService(assetUid, hookUid)
    .done((...args) => {
      actions.hooks.getAll(assetUid);
      actions.hooks.delete.completed(...args);
      if (typeof callbacks.onComplete === 'function') {
        callbacks.onComplete(...args);
      }
    })
    .fail((...args) => {
      actions.hooks.delete.failed(...args);
      if (typeof callbacks.onFail === 'function') {
        callbacks.onFail(...args);
      }
    });
});
actions.hooks.delete.completed.listen((response) => {
  notify(t('REST Service deleted permanently'));
});
actions.hooks.delete.failed.listen((response) => {
  notify(t('Could not delete REST Service'), 'error');
});

actions.hooks.getLogs.listen((assetUid, hookUid, callbacks = {}) => {
  dataInterface.getHookLogs(assetUid, hookUid)
    .done((...args) => {
      actions.hooks.getLogs.completed(...args);
      if (typeof callbacks.onComplete === 'function') {
        callbacks.onComplete(...args);
      }
    })
    .fail((...args) => {
      actions.hooks.getLogs.failed(...args);
      if (typeof callbacks.onFail === 'function') {
        callbacks.onFail(...args);
      }
    });
});

actions.hooks.retryLog.listen((assetUid, hookUid, lid, callbacks = {}) => {
  dataInterface.retryExternalServiceLog(assetUid, hookUid, lid)
    .done((...args) => {
      actions.hooks.getLogs(assetUid, hookUid);
      actions.hooks.retryLog.completed(...args);
      if (typeof callbacks.onComplete === 'function') {
        callbacks.onComplete(...args);
      }
    })
    .fail((...args) => {
      actions.hooks.retryLog.failed(...args);
      if (typeof callbacks.onFail === 'function') {
        callbacks.onFail(...args);
      }
    });
});
actions.hooks.retryLog.completed.listen((response) => {
  notify(t('Submission retry requested successfully'));
});
actions.hooks.retryLog.failed.listen((response) => {
  notify(t('Submission retry request failed'), 'error');
});

actions.hooks.retryLogs.listen((assetUid, hookUid, callbacks = {}) => {
  dataInterface.retryExternalServiceLogs(assetUid, hookUid)
    .done((...args) => {
      actions.hooks.retryLogs.completed(...args);
      if (typeof callbacks.onComplete === 'function') {
        callbacks.onComplete(...args);
      }
    })
    .fail((...args) => {
      actions.hooks.getLogs(assetUid, hookUid);
      actions.hooks.retryLogs.failed(...args);
      if (typeof callbacks.onFail === 'function') {
        callbacks.onFail(...args);
      }
    });
});
actions.hooks.retryLogs.completed.listen((response) => {
  notify(response.detail, 'warning');
});
actions.hooks.retryLogs.failed.listen((response) => {
  notify(t('Retrying all submissions failed'), 'error');
});
