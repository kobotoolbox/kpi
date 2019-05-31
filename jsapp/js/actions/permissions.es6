/**
 * permissions related actions
 */

import Reflux from 'reflux';
import {dataInterface} from 'js/dataInterface';
import {
  t,
  notify
} from 'js/utils';

const permissionsActions = Reflux.createActions({
  getConfig: {children: ['completed', 'failed']},
  getAssetPermissions: {children: ['completed', 'failed']},
  setAssetPermissions: {children: ['completed', 'failed']},
  removeAssetPermissions: {children: ['completed', 'failed']},
  assignPerm: {children: ['completed', 'failed']},
  removePerm: {children: ['completed', 'failed']},
  copyPermissionsFrom: {children: ['completed', 'failed']},
  assignPublicPerm: {children: ['completed', 'failed']},
  setCollectionDiscoverability: {children: ['completed', 'failed']}
});

/**
 * New actions
 */

permissionsActions.getConfig.listen(() => {
  dataInterface.getPermissionsConfig()
    .done(permissionsActions.getConfig.completed)
    .fail(permissionsActions.getConfig.failed);
});

permissionsActions.getAssetPermissions.listen((assetUid) => {
  dataInterface.getAssetPermissions(assetUid)
    .done(permissionsActions.getAssetPermissions.completed)
    .fail(permissionsActions.getAssetPermissions.failed);
});

/**
 * For setting an array of permissions (each permission needs to be a separate call)
 *
 * @param {string} assetUid
 * @param {Object[]} perms - list of permissions to add
 */
permissionsActions.setAssetPermissions.listen((assetUid, perms) => {
  dataInterface.assignAssetPermissions(assetUid, perms)
    .done(() => {
      permissionsActions.getAssetPermissions(assetUid);
      permissionsActions.setAssetPermissions.completed();
    })
    .fail(() => {
      permissionsActions.getAssetPermissions(assetUid);
      permissionsActions.setAssetPermissions.failed();
    });
});

/**
 * For removing an array of permissions
 *
 * @param {string} assetUid
 * @param {string[]} perms - list of permissions urls to remove
 */
permissionsActions.removeAssetPermissions.listen((assetUid, perms) => {
  dataInterface.removeAssetPermissions(perms)
    .done(() => {
      permissionsActions.getAssetPermissions(assetUid);
      permissionsActions.removeAssetPermissions.completed();
    })
    .fail(() => {
      notify(t('failed to remove permissions'), 'error');
      permissionsActions.getAssetPermissions(assetUid);
      permissionsActions.removeAssetPermissions.failed();
    });
});

/**
Old actions
 */

permissionsActions.assignPerm.listen(function(creds){
  dataInterface.assignPerm(creds)
    .done(permissionsActions.assignPerm.completed)
    .fail(permissionsActions.assignPerm.failed);
});
permissionsActions.assignPerm.failed.listen(function(){
  notify(t('failed to update permissions'), 'error');
});

// copies permissions from one asset to other
permissionsActions.copyPermissionsFrom.listen(function(sourceUid, targetUid) {
  dataInterface.copyPermissionsFrom(sourceUid, targetUid)
    .done(() => {
      permissionsActions.getAssetPermissions(targetUid);
      permissionsActions.copyPermissionsFrom.completed(sourceUid, targetUid);
    })
    .fail(permissionsActions.copyPermissionsFrom.failed);
});

permissionsActions.removePerm.listen(function(details){
  if (!details.content_object_uid) {
    throw new Error('removePerm needs a content_object_uid parameter to be set');
  }
  dataInterface.removePerm(details.permission_url)
    .done(function(resp){
      permissionsActions.removePerm.completed(details.content_object_uid, resp);
    })
    .fail(function(resp) {
      permissionsActions.removePerm.failed(details.content_object_uid, resp);
      notify(t('Failed to remove permissions'), 'error');
    });
});

permissionsActions.setCollectionDiscoverability.listen(function(uid, discoverable){
  dataInterface.patchCollection(uid, {discoverable_when_public: discoverable})
    .done(permissionsActions.setCollectionDiscoverability.completed)
    .fail(permissionsActions.setCollectionDiscoverability.failed);
});

export default permissionsActions;
