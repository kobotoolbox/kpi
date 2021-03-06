import {
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
  // TODO do actual check
  // 1. find row by rowName
  // 2. get it's locking profile
  // 3. find locking profile definition (getLockingProfile)
  // 4. see if definition has the restriction
  return true;
}

/**
 * @param {object} asset
 * @param {string} rowName - row or group name
 * @param {string} restrictionName - from FORM_RESTRICTIONS
 */
export function hasAssetRestriction(asset, restrictionName) {
  // TODO:
  // 1. get asset's locking profile
  // 2. find locking profile definition (getLockingProfile)
  // 3. see if definition has the restriction
  return true;
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
