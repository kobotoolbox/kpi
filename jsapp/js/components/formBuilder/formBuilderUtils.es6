import {ASSET_TYPES} from 'js/constants';

/**
 * Makes sure the name follows the rules:
 * - must begin with a letter, colon, or underscore
 * - must contain letters, colons, underscores, numbers, dashes, and periods
 *
 * It replaces illegal characters with underscores.
 *
 * @param {string} rowName - possibly dirty row name
 * @returns {string} clean row name (insert "feels good" meme here)
 */
export function cleanupRowName(rowName) {
  if (typeof rowName !== 'string' || rowName === '') {
    return '';
  }

  let cleanName = rowName;

  // this targets character that is not letter (any unicode letter), colon, and
  // underscore as first character
  const firstCharRegex = /^[^\p{L}:_]/gmiu;
  cleanName = cleanName.replace(firstCharRegex, '_');

  // this targets characters that are not letters (any unicode letters), colons,
  // underscores, numbers, dashes, and periods anywhere in string
  const allCharRegex = /[^\p{L}\w.:-]/gmiu;
  cleanName = cleanName.replace(allCharRegex, '_');

  return cleanName;
}

/**
 * Asset type could be either the loaded asset type (editing an existing form)
 * or the desired asset type (creating a new form)
 *
 * @returns {object|null} one of ASSET_TYPES
 */
export function getFormBuilderAssetType(assetType, desiredAssetType) {
  if (assetType && ASSET_TYPES[assetType]) {
    return ASSET_TYPES[assetType];
  } else if (desiredAssetType && ASSET_TYPES[desiredAssetType]) {
    return ASSET_TYPES[desiredAssetType];
  }
  return null;
}
