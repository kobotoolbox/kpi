import {findRow} from 'js/assetUtils.es6';
import {
  LOCKING_PROP_NAME,
  QUESTION_RESTRICTIONS,
  GROUP_RESTRICTIONS,
  FORM_RESTRICTIONS,
  DEFAULT_LOCKING_PROFILE,
} from './lockingConstants';

/**
 * @param {object} asset
 * @param {string} rowName - row or group name
 * @param {string} restrictionName - from QUESTION_RESTRICTIONS or GROUP_RESTRICTIONS
 * @returns {boolean}
 */
export function hasRowRestriction(asset, rowName, restrictionName) {
  const foundRow = findRow(asset, rowName);
  if (
    foundRow &&
    foundRow[LOCKING_PROP_NAME]
  ) {
    const lockingProfile = getLockingProfile(asset, foundRow[LOCKING_PROP_NAME]);
    return (
      lockingProfile !== null &&
      lockingProfile.restrictions.includes(restrictionName)
    );
  }
  return false;
}

/**
 * @param {object} asset
 * @param {string} rowName - row or group name
 * @param {string} restrictionName - from FORM_RESTRICTIONS
 */
export function hasAssetRestriction(asset, restrictionName) {
  if (asset[LOCKING_PROP_NAME]) {
    const lockingProfile = getLockingProfile(asset, asset[LOCKING_PROP_NAME]);
    return (
      lockingProfile !== null &&
      lockingProfile.restrictions.includes(restrictionName)
    );
  }
  return false;
}

/**
 * @param {object} asset
 * @param {string} profileName
 * @returns {object|null} null for no found
 */
export function getLockingProfile(asset, profileName) {
  let found = null;
  if (profileName === DEFAULT_LOCKING_PROFILE.name) {
    return DEFAULT_LOCKING_PROFILE;
  } else if (asset.settings && asset.settings['locking-profiles']) {
    asset.settings['locking-profiles'].forEach((profile) => {
      if (profile.name === profileName) {
        found = profile;
      }
    });
  }
  return found;
}
