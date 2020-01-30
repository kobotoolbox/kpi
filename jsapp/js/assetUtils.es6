import {stores} from 'js/stores';
import permConfig from 'js/components/permissions/permConfig';
import {
  t,
  buildUserUrl
} from 'js/utils';
import {
  ASSET_TYPES,
  MODAL_TYPES,
  QUESTION_TYPES,
  ANON_USERNAME,
  PERMISSIONS_CODENAMES,
  ACCESS_TYPES,
  ROOT_URL
} from 'js/constants';

/**
 * Removes whitespace from tags.
 * NOTE: Behavior should match KpiTaggableManager.add()
 * @param {Array<string>} tags - list of tags.
 * @return {Array<string>} list of cleaned up tags.
 */
export function cleanupTags(tags) {
  return tags.map(function(tag) {
    return tag.trim().replace(/ /g, '-');
  });
}

/**
 * Returns nicer "me" label for your own assets.
 * @param {string} username
 * @returns {string} nice owner username.
 */
export function getAssetOwnerDisplayName(username) {
  if (
    stores.session.currentAccount &&
    stores.session.currentAccount.username &&
    stores.session.currentAccount.username === username
  ) {
    return t('me');
  } else {
    return username;
  }
}

/**
 * @param {Object} asset - BE asset data
 * @returns {string}
 */
export function getOrganizationDisplayString(asset) {
  if (asset.settings.organization) {
    return asset.settings.organization;
  } else {
    return '-';
  }
}

/**
 * @param {Object} asset - BE asset data
 * @returns {string}
 */
export function getLanguagesDisplayString(asset) {
  if (
    asset.summary &&
    asset.summary.languages &&
    asset.summary.languages.length >= 1
  ) {
    return asset.summary.languages.join(', ');
  } else {
    return '-';
  }
}

/**
 * @param {Object} asset - BE asset data
 * @returns {string}
 */
export function getSectorDisplayString(asset) {
  if (asset.settings.sector) {
    return asset.settings.sector.label;
  } else {
    return '-';
  }
}

/**
 * @param {Object} asset - BE asset data
 * @param {boolean} showLongName - shoul display long name
 * @returns {string}
 */
export function getCountryDisplayString(asset, showLongName = false) {
  if (asset.settings.country) {
    return showLongName ? asset.settings.country.label : asset.settings.country.value;
  } else {
    return '-';
  }
}

/**
 * @typedef DisplayNameObj
 * @prop {string} [original] - Name typed in by user.
 * @prop {string} [question] - First question name.
 * @prop {string} [empty] - Set when no other is available.
 * @prop {string} final - original, question or empty name - the one to be displayed.
 */

/**
 * Returns a name to be displayed for asset (especially unnamed ones).
 * @param {Object} asset - BE asset data
 * @returns {DisplayNameObj} object containing final name and all useful data.
 */
export function getAssetDisplayName(asset) {
  const output = {};
  if (asset.name) {
    output.original = asset.name;
  }
  if (asset.summary && asset.summary.labels && asset.summary.labels.length > 0) {
    // for unnamed assets, we try to display first question name
    output.question = asset.summary.labels[0];
  }
  if (!output.original && !output.question) {
    output.empty = t('untitled');
  }
  output.final = output.original || output.question || output.empty;
  return output;
}

/**
 * @param {Object} question - Part of BE asset data
 * @returns {string} usable name of the question when possible, "Unlabelled" otherwise.
 */
export function getQuestionDisplayName(question) {
  if (question.label) {
    return question.label[0];
  } else if (question.name) {
    return question.name;
  } else if (question.$autoname) {
    return question.$autoname;
  } else {
    t('Unlabelled');
  }
}

/**
 * @param {Object} asset - BE asset data
 * @returns {boolean}
 */
export function isLibraryAsset(assetType) {
  return (
    assetType === ASSET_TYPES.question.id ||
    assetType === ASSET_TYPES.block.id ||
    assetType === ASSET_TYPES.template.id ||
    assetType === ASSET_TYPES.collection.id
  );
}

/**
 * For getting the icon class name for given asset type.
 * @param {Object} asset - BE asset data
 * @returns {string} k-icon CSS class name
 */
export function getAssetIcon(asset) {
  if (asset.asset_type === ASSET_TYPES.template.id) {
    return 'k-icon-template';
  } else if (
    asset.asset_type === ASSET_TYPES.question.id ||
    asset.asset_type === ASSET_TYPES.block.id
  ) {
    return 'k-icon-question-block';
  } else if (asset.asset_type === ASSET_TYPES.survey.id) {
    if (asset.has_deployment) {
      return 'k-icon-deploy';
    } else {
      return 'k-icon-drafts';
    }
  } else if (asset.asset_type === ASSET_TYPES.collection.id) {
    if (isAssetPublic(asset.permissions)) {
      return 'k-icon-folder-public';
    } else if (asset.access_type === ACCESS_TYPES.get('shared')) {
      return 'k-icon-folder-shared';
    } else {
      return 'k-icon-folder';
    }
  }
}

/**
 * Opens a modal for editing asset details.
 * @param {Object} asset - BE asset data
 */
export function modifyDetails(asset) {
  let modalType;
  if (asset.asset_type === ASSET_TYPES.template.id) {
    modalType = MODAL_TYPES.LIBRARY_TEMPLATE;
  } else if (asset.asset_type === ASSET_TYPES.collection.id) {
    modalType = MODAL_TYPES.LIBRARY_COLLECTION;
  }
  stores.pageState.showModal({
    type: modalType,
    asset: asset
  });
}

/**
 * Opens a modal for sharing asset.
 * @param {Object} asset - BE asset data
 */
export function share(asset) {
  stores.pageState.showModal({
    type: MODAL_TYPES.SHARING,
    assetid: asset.uid
  });
}

/**
 * Opens a modal for modifying asset languages and translation strings.
 * @param {Object} asset - BE asset data
 */
export function editLanguages(asset) {
  stores.pageState.showModal({
    type: MODAL_TYPES.FORM_LANGUAGES,
    asset: asset
  });
}

/**
 * Opens a modal for modifying asset tags (also editable in Details Modal).
 * @param {Object} asset - BE asset data
 */
export function editTags(asset) {
  stores.pageState.showModal({
    type: MODAL_TYPES.ASSET_TAGS,
    asset: asset
  });
}

/**
 * Opens a modal for replacing an asset using a file.
 * @param {Object} asset - BE asset data
 */
export function replaceForm(asset) {
  stores.pageState.showModal({
    type: MODAL_TYPES.REPLACE_PROJECT,
    asset: asset
  });
}

/**
 * @param {Object} survey
 * @returns {Object} a pair of quesion names and their full paths
 */
export function getSurveyFlatPaths(survey) {
  const output = {};
  const openedGroups = [];

  survey.forEach((row) => {
    if (row.type === 'begin_group' || row.type === 'begin_repeat') {
      openedGroups.push(row.name || row.$autoname);
    }
    if (row.type === 'end_group' || row.type === 'end_repeat') {
      openedGroups.pop();
    }

    if (QUESTION_TYPES.has(row.type)) {
      const rowName = row.name || row.$autoname;
      let groupsPath = '';
      if (openedGroups.length >= 1) {
        groupsPath = openedGroups.join('/') + '/';
      }

      output[rowName] = `${groupsPath}${rowName}`;
    }
  });

  return output;
}

/**
 * @param {Object} survey
 * @returns {Array<object>} a question object
 */
export function getFlatQuestionsList(survey) {
  const output = [];
  const openedGroups = [];
  survey.forEach((row) => {
    if (row.type === 'begin_group' || row.type === 'begin_repeat') {
      openedGroups.push(getQuestionDisplayName(row));
    }
    if (row.type === 'end_group' || row.type === 'end_repeat') {
      openedGroups.pop();
    }

    if (QUESTION_TYPES.has(row.type)) {
      output.push({
        type: row.type,
        isRequired: row.required,
        label: getQuestionDisplayName(row),
        parents: openedGroups.slice(0)
      });
    }
  });

  return output;
}

/**
 * Validates asset data to see if ready to be made public
 *
 * @param {string} name
 * @param {string} organization
 * @param {string} sector
 *
 * @returns {boolean|Object} true for valid asset and object with errors for invalid one.
 */
export function isAssetPublicReady(name, organization, sector) {
  const errors = {};
  if (!name) {
    errors.name = t('Name is required to make asset public.');
  }
  if (!organization) {
    errors.organization = t('Organization is required to make asset public.');
  }
  if (!sector) {
    errors.sector = t('Sector is required to make asset public.');
  }

  if (Object.keys(errors).length >= 1) {
    return errors;
  } else {
    return true;
  }
}

/**
 * Checks whether the asset is public - i.e. visible and discoverable by anyone.
 * Note that `view_asset` is implied when you have `discover_asset`.
 *
 * @param {Object[]} permissions - Asset permissions.
 *
 * @returns {boolean} Is asset public.
 */
export function isAssetPublic(permissions) {
  let isDiscoverableByAnonymous = false;
  permissions.forEach((perm) => {
    if (
      perm.user === buildUserUrl(ANON_USERNAME) &&
      perm.permission === permConfig.getPermissionByCodename(PERMISSIONS_CODENAMES.get('discover_asset')).url
    ) {
      isDiscoverableByAnonymous = true;
    }
  });
   return isDiscoverableByAnonymous;
}

/**
 * @param {Object} asset - BE asset data
 * @return {boolean}
 */
export function isSelfOwned(asset) {
  return (
    asset &&
    stores.session.currentAccount &&
    asset.owner__username === stores.session.currentAccount.username
  );
}

/**
 * @param {string} assetUid
 * @return {string} assetUrl
 */
export function buildAssetUrl(assetUid) {
  return `${ROOT_URL}/api/v2/assets/${assetUid}/`;
}

export default {
  cleanupTags,
  getAssetOwnerDisplayName,
  getOrganizationDisplayString,
  getLanguagesDisplayString,
  getSectorDisplayString,
  getCountryDisplayString,
  getAssetDisplayName,
  getQuestionDisplayName,
  isLibraryAsset,
  getAssetIcon,
  modifyDetails,
  share,
  editLanguages,
  editTags,
  replaceForm,
  getSurveyFlatPaths,
  getFlatQuestionsList,
  isAssetPublicReady,
  isAssetPublic,
  isSelfOwned,
  buildAssetUrl
};
