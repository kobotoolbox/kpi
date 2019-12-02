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
  bulkSetAssetPermissions: {children: ['completed', 'failed']},
  assignAssetPermission: {children: ['completed', 'failed']},
  removeAssetPermission: {children: ['completed', 'failed']},
  copyPermissionsFrom: {children: ['completed', 'failed']},
  assignPublicPerm: {children: ['completed', 'failed']}
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
      permissionsActions.removeAssetPermission.completed(assetUid);
    })
    .fail(() => {
      notify(t('failed to remove permission'), 'error');
      permissionsActions.getAssetPermissions(assetUid);
      permissionsActions.removeAssetPermission.failed(assetUid);
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
