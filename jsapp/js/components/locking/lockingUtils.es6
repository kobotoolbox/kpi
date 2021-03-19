import {getRowName} from 'js/assetUtils.es6';
import {
  FORM_RESTRICTION_NAMES,
  ROW_RESTRICTION_NAMES,
  LOCK_ALL_RESTRICTION_NAMES,
  LOCK_ALL_PROP_NAME,
  LOCKING_PROFILE_PROP_NAME,
  LOCKING_PROFILES_PROP_NAME,
} from './lockingConstants';

/**
 * @param {object} assetContent asset's object content property
 * @param {string} rowName - row or group name
 * @param {string} restrictionName - from QUESTION_RESTRICTIONS or GROUP_RESTRICTIONS
 * @returns {boolean}
 */
export function hasRowRestriction(assetContent, rowName, restrictionName) {
  // case 1
  // only check restrictions that apply to rows
  if (!ROW_RESTRICTION_NAMES.includes(restrictionName)) {
    console.warn(`row ${rowName} can't have restriction ${restrictionName}`);
    return false;
  }

  // case 2
  // if lock_all is enabled, then all rows have all restrictions from lock all list
  if (
    assetContent.settings &&
    assetContent.settings[LOCK_ALL_PROP_NAME] === true
  ) {
    return LOCK_ALL_RESTRICTION_NAMES.includes(restrictionName);
  }

  // case 3
  const foundRow = assetContent.survey.find((row) => {
    return getRowName(row) === rowName;
  });
  if (
    foundRow &&
    foundRow[LOCKING_PROFILE_PROP_NAME]
  ) {
    const lockingProfile = getLockingProfile(assetContent, foundRow[LOCKING_PROFILE_PROP_NAME]);
    return (
      lockingProfile !== null &&
      lockingProfile.restrictions.includes(restrictionName)
    );
  }

  // default
  return false;
}

/**
 * @param {object} assetContent asset's object content property
 * @param {string} rowName - row or group name
 * @param {string} restrictionName - from FORM_RESTRICTIONS
 */
export function hasAssetRestriction(assetContent, restrictionName) {
  // case 1
  // only check restrictions that apply to forms
  if (!FORM_RESTRICTION_NAMES.includes(restrictionName)) {
    console.warn(`asset can't have restriction ${restrictionName}`);
    return false;
  }

  // case 2
  // if lock_all is enabled, then form has all restrictions from lock all list
  if (
    assetContent.settings &&
    assetContent.settings[LOCK_ALL_PROP_NAME] === true
  ) {
    return LOCK_ALL_RESTRICTION_NAMES.includes(restrictionName);
  }

  // case 3
  if (
    assetContent.settings &&
    assetContent.settings[LOCKING_PROFILE_PROP_NAME]
  ) {
    const lockingProfile = getLockingProfile(assetContent, assetContent.settings[LOCKING_PROFILE_PROP_NAME]);
    return (
      lockingProfile !== null &&
      lockingProfile.restrictions.includes(restrictionName)
    );
  }

  // default
  return false;
}

/**
 * @param {object} assetContent asset's object content property
 * @param {string} profileName
 * @returns {object|null} null for no found
 */
export function getLockingProfile(assetContent, profileName) {
  let found = null;
  if (
    assetContent &&
    Array.isArray(assetContent[LOCKING_PROFILES_PROP_NAME])
  ) {
    assetContent[LOCKING_PROFILES_PROP_NAME].forEach((profile) => {
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
 * @param {object} assetContent asset's object content property
 * @returns {boolean} whether form or any row has locking on it
 */
export function isAssetLocked(assetContent) {
  // case 1
  // asset has lock_all
  if (
    assetContent.settings &&
    assetContent.settings[LOCK_ALL_PROP_NAME] === true
  ) {
    return true;
  }

  // case 2
  // asset has locking profile
  if (
    assetContent.settings &&
    typeof assetContent.settings[LOCKING_PROFILE_PROP_NAME] === 'string' &&
    assetContent.settings[LOCKING_PROFILE_PROP_NAME].length >= 1
  ) {
    return true;
  }

  // case 3
  // at least one row has locking profile
  const foundRow = assetContent.survey.find((row) => {
    return (
      typeof row[LOCKING_PROFILE_PROP_NAME] === 'string' &&
      row[LOCKING_PROFILE_PROP_NAME].length >= 1
    );
  });
  return Boolean(foundRow);
}

/**
 * Checks if asset has `lock_all`, i.e. everything locked
 *
 * @param {object} assetContent asset's object content property
 * @returns {boolean}
 */
export function isAssetAllLocked(assetContent) {
  return Boolean(
    assetContent.settings &&
    assetContent.settings[LOCK_ALL_PROP_NAME] === true
  );
}
