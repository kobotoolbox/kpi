import {getRowName} from 'js/assetUtils';
import {AssetTypeName} from 'js/constants';
import {
  QUESTION_RESTRICTIONS,
  GROUP_RESTRICTIONS,
  FORM_RESTRICTIONS,
  LOCK_ALL_RESTRICTION_NAMES,
  LOCK_ALL_PROP_NAME,
  LOCKING_PROFILE_PROP_NAME,
  LOCKING_PROFILES_PROP_NAME,
  type LockingRestrictionName,
  type AssetLockingProfileDefinition,
  type IndexedAssetLockingProfileDefinition,
  type LockingRestrictionDefinition,
} from './lockingConstants';
import type {AssetContent} from 'js/dataInterface';

/**
 * Should be used with QUESTION_RESTRICTIONS or GROUP_RESTRICTIONS
 */
export function hasRowRestriction(
  assetContent: AssetContent,
  rowName: string,
  restrictionName: LockingRestrictionName
): boolean {
  // case 1
  // if lock_all is enabled, then all rows have all restrictions from lock all list
  if (isAssetAllLocked(assetContent)) {
    return LOCK_ALL_RESTRICTION_NAMES.includes(restrictionName);
  }

  // case 2
  // check if row's locking profile definition has the searched restriction
  const foundProfile = getRowLockingProfile(assetContent, rowName);
  if (foundProfile) {
    return foundProfile.restrictions.includes(restrictionName);
  }

  // default
  return false;
}

/** Checks whether an asset has given restriction. */
export function hasAssetRestriction(
  assetContent: AssetContent,
  restrictionName: LockingRestrictionName
) {
  // case 1
  // if lock_all is enabled, then form has all restrictions from lock all list
  if (isAssetAllLocked(assetContent)) {
    return LOCK_ALL_RESTRICTION_NAMES.includes(restrictionName);
  }

  // case 2
  // check if asset's locking profile definition has the searched restriction
  const foundProfile = getAssetLockingProfile(assetContent);
  if (foundProfile) {
    return foundProfile.restrictions.includes(restrictionName);
  }

  // default
  return false;
}

/**
 * Finds locking profile by name in given asset.
 * Returns `null` if not found.
 */
export function getLockingProfile(
  assetContent: AssetContent,
  profileName: string
): null | IndexedAssetLockingProfileDefinition {
  const lockingProfiles = assetContent?.[LOCKING_PROFILES_PROP_NAME];
  if (!lockingProfiles || !Array.isArray(lockingProfiles)) {return null;}
  const lockingProfileIndex = lockingProfiles.findIndex((profile) => profile.name === profileName);
  if (lockingProfileIndex === -1) {return null;}
  const lockingProfile = lockingProfiles[lockingProfileIndex];

  // we make a copy of profile definition to add index to it
  return {
    index: lockingProfileIndex,
    name: lockingProfile.name,
    restrictions: lockingProfile.restrictions,
  };
}

/**
 * Find locking profile of given row - you don't need to know if row has
 * a profile or what's it's name.
 * Returns `null` if not found.
 */
export function getRowLockingProfile(
  assetContent: AssetContent,
  rowName: string
) {
  if (!assetContent?.survey) {
    return null;
  }

  const foundRow = assetContent.survey.find((row) =>
    getRowName(row) === rowName
  );
  if (
    foundRow &&
    typeof foundRow[LOCKING_PROFILE_PROP_NAME] === 'string' &&
    foundRow[LOCKING_PROFILE_PROP_NAME].length >= 1
  ) {
    return getLockingProfile(assetContent, foundRow[LOCKING_PROFILE_PROP_NAME]);
  }

  return null;
}

/**
 * Find locking profile of asset - you don't need to know if asset has
 * a profile or what's it's name.
 * Returns `null` if not found.
 */
export function getAssetLockingProfile(assetContent: AssetContent) {
  if (
    assetContent.settings &&
    LOCKING_PROFILE_PROP_NAME in assetContent.settings &&
    typeof assetContent.settings[LOCKING_PROFILE_PROP_NAME] === 'string' &&
    assetContent.settings[LOCKING_PROFILE_PROP_NAME].length >= 1
  ) {
    return getLockingProfile(assetContent, assetContent.settings[LOCKING_PROFILE_PROP_NAME]);
  }

  return null;
}

/**
 * Checks if row has any locking applied, i.e. row has `locking_profile` set and
 * this locking profile has a definition in the asset content settings. As it is
 * actually possible for row to have a locking profile name that the asset
 * doesn't have a definition for. If asset has `lock_all` this will also be true.
 */
export function isRowLocked(assetContent: AssetContent, rowName: string) {
  return (
    isAssetAllLocked(assetContent) ||
    Boolean(getRowLockingProfile(assetContent, rowName))
  );
}

/**
 * Checks if asset is locked, i.e. has `lock_all` or `locking_profile` (with
 * a definition).
 */
export function isAssetLocked(assetContent: AssetContent) {
  return (
    isAssetAllLocked(assetContent) ||
    Boolean(getAssetLockingProfile(assetContent))
  );
}

/**
 * Checks if anything in the asset is locked, i.e. asset has `lock_all` or
 * `locking_profile` is being set for it or any row.
 */
export function hasAssetAnyLocking(assetContent: AssetContent) {
  // at least one row has locking profile that is defined in asset
  const foundLockedRow = assetContent?.survey?.find((row) =>
    isRowLocked(assetContent, getRowName(row))
  );

  return (
    isAssetLocked(assetContent) ||
    Boolean(foundLockedRow)
  );
}

/**
 * Checks if asset has `lock_all`, i.e. "everything locked" flag is on.
 * NOTE: if every restriction is locked, but `lock_all` is not set, this will
 * be false.
 */
export function isAssetAllLocked(assetContent: AssetContent) {
  return Boolean(
    assetContent?.settings &&
    LOCK_ALL_PROP_NAME in assetContent.settings &&
    assetContent.settings[LOCK_ALL_PROP_NAME] === true
  );
}

/**
 * Useful to check if given asset can be locked. I.e. if it should have some UI
 * elements locked (e.g. disabled or hidden) when it's being locked.
 */
export function isAssetLockable(assetType: AssetTypeName) {
  return assetType === AssetTypeName.survey || assetType === AssetTypeName.template;
}

/**
 * Returns a list of enabled/disabled restrictions for given question.
 * Returns `null` if question or profile not found.
 */
export function getQuestionFeatures(
  assetContent: AssetContent,
  rowName: string
) {
  // if question does not exist then return null
  const foundRow = assetContent.survey?.find((row) =>
    getRowName(row) === rowName
  );
  if (!foundRow) {
    return null;
  }

  return _getFeatures(
    QUESTION_RESTRICTIONS,
    getRowLockingProfile(assetContent, rowName),
    isAssetAllLocked(assetContent)
  );
}

/**
 * Returns a list of enabled/disabled restrictions for given group.
 * Returns `null` if group or profile not found.
 */
export function getGroupFeatures(
  assetContent: AssetContent,
  rowName: string
) {
  // if question does not exist then return null
  const foundRow = assetContent.survey?.find((row) =>
    getRowName(row) === rowName
  );
  if (!foundRow) {
    return null;
  }

  return _getFeatures(
    GROUP_RESTRICTIONS,
    getRowLockingProfile(assetContent, rowName),
    isAssetAllLocked(assetContent)
  );
}

/**
 * Returns a list of enabled/disabled restrictions for a form.
 * Returns `null` if profile not found.
 */
export function getFormFeatures(assetContent: AssetContent) {
  return _getFeatures(
    FORM_RESTRICTIONS,
    getAssetLockingProfile(assetContent),
    isAssetAllLocked(assetContent)
  );
}

interface LockingCansCants {
  cans: LockingRestrictionDefinition[];
  cants: LockingRestrictionDefinition[];
}

/**
 * @private Internal use DRY function.
 * Returns two lists - the restrictions that apply to row/asset (`cans`) and
 * the one's that don't (`cants`). Pass a list of restriction definitions,
 * profile name, and whether `lock_all` is on.
 */
function _getFeatures(
  sourceList: LockingRestrictionDefinition[],
  profile: AssetLockingProfileDefinition | null,
  isAllLocked: boolean
): LockingCansCants {
  const outcome: LockingCansCants = {
    cans: [],
    cants: [],
  };

  sourceList.forEach((restriction) => {
    if (isAllLocked || profile?.restrictions.includes(restriction.name)) {
      outcome.cants.push(restriction);
    } else {
      outcome.cans.push(restriction);
    }
  });

  return outcome;
}
