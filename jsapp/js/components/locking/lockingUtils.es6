import {findRow} from 'js/assetUtils.es6';
import {
  FORM_RESTRICTION_NAMES,
  ROW_RESTRICTION_NAMES,
  LOCK_ALL_RESTRICTION_NAMES,
  LOCK_ALL_PROP_NAME,
  LOCKING_PROFILE_PROP_NAME,
  LOCKING_PROFILES_PROP_NAME,
} from './lockingConstants';

/**
 * @param {object} asset
 * @param {string} rowName - row or group name
 * @param {string} restrictionName - from QUESTION_RESTRICTIONS or GROUP_RESTRICTIONS
 * @returns {boolean}
 */
export function hasRowRestriction(asset, rowName, restrictionName) {
  // case 1
  // only check restrictions that apply to rows
  if (!ROW_RESTRICTION_NAMES.includes(restrictionName)) {
    console.warn(`row ${rowName} can't have restriction ${restrictionName}`);
    return false;
  }

  // case 2
  // if lock_all is enabled, then all rows have all restrictions from lock all list
  if (
    asset.content?.settings &&
    asset.content.settings[LOCK_ALL_PROP_NAME] === true
  ) {
    return LOCK_ALL_RESTRICTION_NAMES.includes(restrictionName);
  }

  // case 3
  const foundRow = findRow(asset, rowName);
  if (
    foundRow &&
    foundRow[LOCKING_PROFILE_PROP_NAME]
  ) {
    const lockingProfile = getLockingProfile(asset, foundRow[LOCKING_PROFILE_PROP_NAME]);
    return (
      lockingProfile !== null &&
      lockingProfile.restrictions.includes(restrictionName)
    );
  }

  // default
  return false;
}

/**
 * @param {object} asset
 * @param {string} rowName - row or group name
 * @param {string} restrictionName - from FORM_RESTRICTIONS
 */
export function hasAssetRestriction(asset, restrictionName) {
  // case 1
  // only check restrictions that apply to forms
  if (!FORM_RESTRICTION_NAMES.includes(restrictionName)) {
    console.warn(`asset can't have restriction ${restrictionName}`);
    return false;
  }

  // case 2
  // if lock_all is enabled, then form has all restrictions from lock all list
  if (
    asset.content?.settings &&
    asset.content.settings[LOCK_ALL_PROP_NAME] === true
  ) {
    return LOCK_ALL_RESTRICTION_NAMES.includes(restrictionName);
  }

  // case 3
  if (
    asset.content?.settings &&
    asset.content.settings[LOCKING_PROFILE_PROP_NAME]
  ) {
    const lockingProfile = getLockingProfile(asset, asset.content.settings[LOCKING_PROFILE_PROP_NAME]);
    return (
      lockingProfile !== null &&
      lockingProfile.restrictions.includes(restrictionName)
    );
  }

  // default
  return false;
}

/**
 * @param {object} asset
 * @param {string} profileName
 * @returns {object|null} null for no found
 */
export function getLockingProfile(asset, profileName) {
  let found = null;
  if (
    asset.content &&
    Array.isArray(asset.content.[LOCKING_PROFILES_PROP_NAME])
  ) {
    asset.content.[LOCKING_PROFILES_PROP_NAME].forEach((profile) => {
      if (profile.name === profileName) {
        found = profile;
      }
    });
  }
  return found;
}

/**
 * Checks if anything in the asset is locked, i.e. asset has `lock_all` or
 * `locking_profile` is being set for it or any row.
 *
 * @param {object} asset
 * @returns {boolean} whether form or any row has locking on it
 */
export function isAssetLocked(asset) {
  // case 1
  // asset has lock_all
  if (
    asset.content?.settings &&
    asset.content.settings[LOCK_ALL_PROP_NAME] === true
  ) {
    return true;
  }

  // case 2
  // asset has locking profile
  if (
    typeof asset[LOCKING_PROFILE_PROP_NAME] === 'string' &&
    asset[LOCKING_PROFILE_PROP_NAME].length >= 1
  ) {
    return true;
  }

  // case 3
  // at least one row has locking profile
  const foundRow = asset.content.survey.find((row) => {
    return (
      typeof row[LOCKING_PROFILE_PROP_NAME] === 'string' &&
      row[LOCKING_PROFILE_PROP_NAME].length >= 1
    );
  });
  return Boolean(foundRow);
}
