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
 * @returns {object}
 */
export function getLockingProfile(asset, profileName) {
  // TODO find profile by name
  return {}
}
