import permConfig from 'js/components/permissions/permConfig';
import {notify} from 'js/utils';
import {replaceSupportEmail} from 'js/textUtils';
import type {PermissionResponse} from 'js/dataInterface';
import union from 'lodash.union';

export const INVALID_PERMS_ERROR = t(
  'The stored permissions are invalid. Please assign them again. If this problem persists, contact help@kobotoolbox.org'
);

/**
 * Checks if the permissions data coming from Back end is valid. If there are
 * some issues, it will display a notification. Returns a boolean value of
 * the validity check.
 */
export function validateBackendPermissions(
  permissionAssignments: PermissionResponse[]
) {
  let allImplied: string[] = [];
  let allContradictory: string[] = [];

  const appendUserUrl = (permission: string, userUrl: string) =>
    `${permission}###${userUrl}`;
  const appendUserUrls = (permissions: string[], userUrl: string) =>
    permissions.map((permission) => appendUserUrl(permission, userUrl));

  permissionAssignments.forEach((assignment) => {
    const permDef = permConfig.getPermission(assignment.permission);
    if (!permDef) {
      return;
    }
    allImplied = union(
      allImplied,
      appendUserUrls(permDef.implied, assignment.user)
    );
    allContradictory = union(
      allContradictory,
      appendUserUrls(permDef.contradictory, assignment.user)
    );
  });

  let hasAllImplied = true;
  // FIXME: `manage_asset` implies all the `*_submission` permissions, but
  // those are assignable *only* when the asset type is 'survey'. We need to
  // design a way to pass that nuance from the back end to the front end
  /*
  allImplied.forEach((implied) => {
    let isFound = false;
    permissionAssignments.forEach((assignment) => {
      let permission = appendUserUrl(assignment.permission, assignment.user);
      if (permission === implied) {
        isFound = true;
      }
    });
    if (isFound === false) {
      hasAllImplied = false;
    }
  });
  */

  let hasAnyContradictory = false;
  allContradictory.forEach((contradictory) => {
    permissionAssignments.forEach((assignment) => {
      const permission = appendUserUrl(assignment.permission, assignment.user);
      if (permission === contradictory) {
        hasAnyContradictory = true;
      }
    });
  });

  // Valid permissions list should include all the implied and zero
  // contradictory permissions.
  if (!hasAllImplied || hasAnyContradictory) {
    notify(replaceSupportEmail(INVALID_PERMS_ERROR), 'error');
    return false;
  }
  return true;
}
