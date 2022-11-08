/**
 * permissions related actions
 */

import Reflux from 'reflux';
import RefluxPromise from 'js/libs/reflux-promise';
Reflux.use(RefluxPromise(window.Promise));
import {dataInterface} from 'js/dataInterface';
import {
  notify,
  buildUserUrl,
} from 'utils';
import {
  ANON_USERNAME,
  PERMISSIONS_CODENAMES,
} from 'js/constants';
import permConfig from 'js/components/permissions/permConfig';

export const permissionsActions = Reflux.createActions({
  getConfig: {children: ['completed', 'failed']},
  getAssetPermissions: {children: ['completed', 'failed']},
  bulkSetAssetPermissions: {children: ['completed', 'failed']},
  assignAssetPermission: {children: ['completed', 'failed']},
  removeAssetPermission: {children: ['completed', 'failed']},
  setAssetPublic: {children: ['completed', 'failed']},
  copyPermissionsFrom: {children: ['completed', 'failed']},
});

/**
 * New actions
 */

permissionsActions.getConfig.listen(() => {
  dataInterface.getPermissionsConfig()
    .done(permissionsActions.getConfig.completed)
    .fail(permissionsActions.getConfig.failed);
});

permissionsActions.getConfig.failed.listen(() => {
  notify('Failed to get permissions config!', 'error');
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
permissionsActions.bulkSetAssetPermissions.listen((assetUid, perms) => {
  dataInterface.bulkSetAssetPermissions(assetUid, perms)
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
permissionsActions.removeAssetPermission.listen((assetUid, perm, isNonOwner) => {
  dataInterface.removePermission(perm)
    .done(() => {
      // Avoid this call if a non-owner removed their own permissions as it will fail
      if (!isNonOwner) {
        permissionsActions.getAssetPermissions(assetUid);
      }
      permissionsActions.removeAssetPermission.completed(assetUid, isNonOwner);
    })
    .fail(() => {
      permissionsActions.getAssetPermissions(assetUid);
      permissionsActions.removeAssetPermission.failed(assetUid);
    });
});

/**
 * Makes asset public or private. This is a special action that mixes
 * bulkSetAssetPermissions and removeAssetPermission to elegantly solve a
 * particular problem.
 *
 * @param {Object} asset - BE asset data
 * @param {boolean} shouldSetAnonPerms
 */
permissionsActions.setAssetPublic.listen((asset, shouldSetAnonPerms) => {
  if (shouldSetAnonPerms) {
    const permsToSet = asset.permissions.filter((permissionAssignment) => {
      return permissionAssignment.user !== asset.owner;
    });
    permsToSet.push({
      user: buildUserUrl(ANON_USERNAME),
      permission: permConfig.getPermissionByCodename(PERMISSIONS_CODENAMES.view_asset).url
    });
    permsToSet.push({
      user: buildUserUrl(ANON_USERNAME),
      permission: permConfig.getPermissionByCodename(PERMISSIONS_CODENAMES.discover_asset).url
    });
    dataInterface.bulkSetAssetPermissions(asset.uid, permsToSet)
      .done(() => {permissionsActions.setAssetPublic.completed(asset.uid, shouldSetAnonPerms);})
      .fail(() => {permissionsActions.setAssetPublic.failed(asset.uid, shouldSetAnonPerms);});
  } else {
    const permToRemove = asset.permissions.find((permissionAssignment) => {
      return (
        permissionAssignment.user === buildUserUrl(ANON_USERNAME) &&
        permissionAssignment.permission === permConfig.getPermissionByCodename(PERMISSIONS_CODENAMES.view_asset).url
      );
    });
    dataInterface.removePermission(permToRemove.url)
      .done(() => {permissionsActions.setAssetPublic.completed(asset.uid, shouldSetAnonPerms);})
      .fail(() => {permissionsActions.setAssetPublic.failed(asset.uid, shouldSetAnonPerms);});
  }
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
