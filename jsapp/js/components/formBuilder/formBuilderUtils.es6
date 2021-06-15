import {ASSET_TYPES} from 'js/constants';

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
