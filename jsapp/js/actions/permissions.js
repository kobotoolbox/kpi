/**
 * permissions related actions
 */

import Reflux from 'reflux'
import permConfig from '#/components/permissions/permConfig'
import { PERMISSIONS_CODENAMES } from '#/components/permissions/permConstants'
import { INVALID_PERMS_ERROR, validateBackendPermissions } from '#/components/permissions/validatePermissions'
import { dataInterface } from '#/dataInterface'
import RefluxPromise from '#/libs/reflux-promise'
import { ANON_USERNAME_URL } from '#/users/utils'
import { notify } from '#/utils'

Reflux.use(RefluxPromise(window.Promise))

/**
 * @deprecated migrate to react-query whenever you need to adjust things beyond simple rename
 */
export const permissionsActions = Reflux.createActions({
  getConfig: { children: ['completed', 'failed'] },
  getAssetPermissions: { children: ['completed', 'failed'] },
  bulkSetAssetPermissions: { children: ['completed', 'failed'] },
  assignAssetPermission: { children: ['completed', 'failed'] },
  removeAssetPermission: { children: ['completed', 'failed'] },
  setAssetPublic: { children: ['completed', 'failed'] },
  copyPermissionsFrom: { children: ['completed', 'failed'] },
})

/**
 * New actions
 */

permissionsActions.getConfig.listen(() => {
  dataInterface
    .getPermissionsConfig()
    .done(permissionsActions.getConfig.completed)
    .fail(permissionsActions.getConfig.failed)
})

permissionsActions.getConfig.failed.listen(() => {
  notify('Failed to get permissions config!', 'error')
})

permissionsActions.getAssetPermissions.listen((assetUid) => {
  dataInterface
    .getAssetPermissions(assetUid)
    .done((response) => {
      if (validateBackendPermissions(response)) {
        permissionsActions.getAssetPermissions.completed(response)
      } else {
        permissionsActions.getAssetPermissions.failed(INVALID_PERMS_ERROR)
      }
    })
    .fail(permissionsActions.getAssetPermissions.failed)
})

/**
 * For bulk setting permissions - wipes all current permissions, sets given ones
 *
 * @param {string} assetUid
 * @param {Object[]} perms - permissions to set
 */
permissionsActions.bulkSetAssetPermissions.listen((assetUid, perms) => {
  dataInterface
    .bulkSetAssetPermissions(assetUid, perms)
    .done((permissionAssignments) => {
      permissionsActions.bulkSetAssetPermissions.completed(permissionAssignments)
    })
    .fail(() => {
      permissionsActions.getAssetPermissions(assetUid)
      permissionsActions.bulkSetAssetPermissions.failed()
    })
})

/**
 * For adding single asset permission
 *
 * @param {string} assetUid
 * @param {Object} perm - permission to add
 */
permissionsActions.assignAssetPermission.listen((assetUid, perm) => {
  dataInterface
    .assignAssetPermission(assetUid, perm)
    .done(() => {
      permissionsActions.getAssetPermissions(assetUid)
      permissionsActions.assignAssetPermission.completed(assetUid)
    })
    .fail(() => {
      permissionsActions.getAssetPermissions(assetUid)
      permissionsActions.assignAssetPermission.failed(assetUid)
    })
})

/**
 * For removing asset permissions
 *
 * @param {string} assetUid
 * @param {string} perm - permission url
 * @param {boolean} removeAll - set to true to remove all permissions. Defaults to removing a single permission.
 * @param {boolean} isNonOwner
 */
permissionsActions.removeAssetPermission.listen((assetUid, perm, removeAll, isNonOwner, username) => {
  let removalPromise

  if (removeAll) {
    removalPromise = dataInterface.removeAllPermissions(assetUid, username)
  } else {
    removalPromise = dataInterface.removePermission(perm)
  }

  removalPromise
    .done(() => {
      if (!isNonOwner) {
        permissionsActions.getAssetPermissions(assetUid)
      }
      permissionsActions.removeAssetPermission.completed(assetUid, isNonOwner)
    })
    .fail(() => {
      permissionsActions.getAssetPermissions(assetUid)
      permissionsActions.removeAssetPermission.failed(assetUid)
    })
})

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
    const permsToSet = asset.permissions.filter((permissionAssignment) => permissionAssignment.user !== asset.owner)
    permsToSet.push({
      user: ANON_USERNAME_URL,
      permission: permConfig.getPermissionByCodename(PERMISSIONS_CODENAMES.view_asset).url,
    })
    permsToSet.push({
      user: ANON_USERNAME_URL,
      permission: permConfig.getPermissionByCodename(PERMISSIONS_CODENAMES.discover_asset).url,
    })
    dataInterface
      .bulkSetAssetPermissions(asset.uid, permsToSet)
      .done(() => {
        permissionsActions.setAssetPublic.completed(asset.uid, shouldSetAnonPerms)
      })
      .fail(() => {
        permissionsActions.setAssetPublic.failed(asset.uid, shouldSetAnonPerms)
      })
  } else {
    const permToRemove = asset.permissions.find(
      (permissionAssignment) =>
        permissionAssignment.user === ANON_USERNAME_URL &&
        permissionAssignment.permission === permConfig.getPermissionByCodename(PERMISSIONS_CODENAMES.view_asset).url,
    )
    dataInterface
      .removePermission(permToRemove.url)
      .done(() => {
        permissionsActions.setAssetPublic.completed(asset.uid, shouldSetAnonPerms)
      })
      .fail(() => {
        permissionsActions.setAssetPublic.failed(asset.uid, shouldSetAnonPerms)
      })
  }
})

// copies permissions from one asset to other
permissionsActions.copyPermissionsFrom.listen((sourceUid, targetUid) => {
  dataInterface
    .copyPermissionsFrom(sourceUid, targetUid)
    .done(() => {
      permissionsActions.getAssetPermissions(targetUid)
      permissionsActions.copyPermissionsFrom.completed(sourceUid, targetUid)
    })
    .fail(permissionsActions.copyPermissionsFrom.failed)
})
