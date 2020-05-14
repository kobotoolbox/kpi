/**
 * permissions related actions
 */

import Reflux from 'reflux';
import RefluxPromise from 'js/libs/reflux-promise';
Reflux.use(RefluxPromise(window.Promise));
import {dataInterface} from 'js/dataInterface';
import {
  t,
  notify
} from 'js/utils';

export const permissionsActions = Reflux.createActions({
  getConfig: {children: ['completed', 'failed']},
  getAssetPermissions: {children: ['completed', 'failed']},
  getCollectionPermissions: {children: ['completed', 'failed']},
  bulkSetAssetPermissions: {children: ['completed', 'failed']},
  assignCollectionPermission: {children: ['completed', 'failed']},
  assignAssetPermission: {children: ['completed', 'failed']},
  removeAssetPermission: {children: ['completed', 'failed']},
  removeCollectionPermission: {children: ['completed', 'failed']},
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

permissionsActions.getCollectionPermissions.listen((uid) => {
  dataInterface.getCollectionPermissions(uid)
    .done(permissionsActions.getCollectionPermissions.completed)
    .fail(permissionsActions.getCollectionPermissions.failed);
});

/**
 * For bulk setting permissions - wipes all current permissions, sets given ones
 *
 * @param {string} assetUid
 * @param {Object[]} perms - permissions to set
 */
permissionsActions.bulkSetAssetPermissions.listen((assetUid, perm) => {
  dataInterface.bulkSetAssetPermissions(assetUid, perm)
    .done((permissionAssignments) => {
      permissionsActions.bulkSetAssetPermissions.completed(permissionAssignments);
    })
    .fail(() => {
      permissionsActions.getAssetPermissions(assetUid);
      permissionsActions.bulkSetAssetPermissions.failed();
    });
});

/**
 * For adding single collection permission
 *
 * @param {string} uid - collection uid
 * @param {Object} perm - permission to add
 */
permissionsActions.assignCollectionPermission.listen((uid, perm) => {
  dataInterface.assignCollectionPermission(uid, perm)
    .done(() => {
      permissionsActions.getCollectionPermissions(uid);
      permissionsActions.assignCollectionPermission.completed(uid);
    })
    .fail(() => {
      permissionsActions.getCollectionPermissions(uid);
      permissionsActions.assignCollectionPermission.failed(uid);
    });
});

/**
 * For adding single asset permission
 *
 * @param {string} assetUid
 * @param {Object} perm - permission to add
 */
permissionsActions.assignAssetPermission.listen((assetUid, perm) => {
  dataInterface.assignAssetPermission(assetUid, perm)
    .done(() => {
      permissionsActions.getAssetPermissions(assetUid);
      permissionsActions.assignAssetPermission.completed(assetUid);
    })
    .fail(() => {
      permissionsActions.getAssetPermissions(assetUid);
      permissionsActions.assignAssetPermission.failed(assetUid);
    });
});

/**
 * For removing single permission
 *
 * @param {string} assetUid
 * @param {string} perm - permission url
 */
permissionsActions.removeAssetPermission.listen((assetUid, perm) => {
  dataInterface.removePermission(perm)
    .done(() => {
      permissionsActions.getAssetPermissions(assetUid);
      permissionsActions.removeAssetPermission.completed();
    })
    .fail(() => {
      permissionsActions.getAssetPermissions(assetUid);
      permissionsActions.removeAssetPermission.failed();
    });
});

/**
 * For removing single permission
 *
 * @param {string} uid
 * @param {string} perm - permission url
 */
permissionsActions.removeCollectionPermission.listen((uid, perm) => {
  dataInterface.removePermission(perm)
    .done(() => {
      permissionsActions.getCollectionPermissions(uid);
      permissionsActions.removeCollectionPermission.completed();
    })
    .fail(() => {
      permissionsActions.getCollectionPermissions(uid);
      permissionsActions.removeCollectionPermission.failed();
    });
});

/**
Old actions
 */

// copies permissions from one asset to other
permissionsActions.copyPermissionsFrom.listen(function(sourceUid, targetUid) {
  dataInterface.copyPermissionsFrom(sourceUid, targetUid)
    .done(() => {
      permissionsActions.getAssetPermissions(targetUid);
      permissionsActions.copyPermissionsFrom.completed(sourceUid, targetUid);
    })
    .fail(permissionsActions.copyPermissionsFrom.failed);
});

permissionsActions.setCollectionDiscoverability.listen(function(uid, discoverable){
  dataInterface.patchCollection(uid, {discoverable_when_public: discoverable})
    .done(permissionsActions.setCollectionDiscoverability.completed)
    .fail(permissionsActions.setCollectionDiscoverability.failed);
});
