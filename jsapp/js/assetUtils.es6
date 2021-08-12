import React from 'react';
import {stores} from 'js/stores';
import permConfig from 'js/components/permissions/permConfig';
import {buildUserUrl} from 'utils';
import {
  ASSET_TYPES,
  MODAL_TYPES,
  QUESTION_TYPES,
  META_QUESTION_TYPES,
  GROUP_TYPES_BEGIN,
  GROUP_TYPES_END,
  SCORE_ROW_TYPE,
  RANK_LEVEL_TYPE,
  ANON_USERNAME,
  PERMISSIONS_CODENAMES,
  ACCESS_TYPES,
  ROOT_URL,
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
 * @param {string} langString - language string (the de facto "id")
 * @returns {number|null} the index of language or null if not found
 */
export function getLanguageIndex(asset, langString) {
  let foundIndex = null;

  if (asset.summary?.languages?.length >= 1) {
    asset.summary.languages.forEach((language, index) => {
      if (language === langString) {
        foundIndex = index;
      }
    });
  }

  return foundIndex;
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
 * @param {Object} questionOrChoice - Part of BE asset data
 * @param {number} [translationIndex] - defaults to first (default) language
 * @returns {string} usable name of the question or choice when possible, "Unlabelled" otherwise.
 */
export function getQuestionOrChoiceDisplayName(questionOrChoice, translationIndex = 0) {
  if (questionOrChoice.label && Array.isArray(questionOrChoice.label)) {
    return questionOrChoice.label[translationIndex];
  } else if (questionOrChoice.label && !Array.isArray(questionOrChoice.label)) {
    // in rare cases the label could be a string
    return questionOrChoice.label;
  } else if (questionOrChoice.name) {
    return questionOrChoice.name;
  } else if (questionOrChoice.$autoname) {
    return questionOrChoice.$autoname;
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
 * @returns {string} Contians two class names: Base `k-icon` class name and respective CSS class name
 */
export function getAssetIcon(asset) {
  switch (asset.asset_type) {
    case ASSET_TYPES.template.id:
      if (asset.summary?.lock_any) {
        return 'k-icon k-icon-template-locked';
      } else {
        return 'k-icon k-icon-template';
      }
    case ASSET_TYPES.question.id:
      return 'k-icon k-icon-question';
    case ASSET_TYPES.block.id:
      return 'k-icon k-icon-block';
    case ASSET_TYPES.survey.id:
      if (asset.summary?.lock_any) {
        return 'k-icon k-icon-form-locked';
      } else if (asset.has_deployment && !asset.deployment__active) {
        return 'k-icon k-icon-form-archived';
      } else if (asset.has_deployment) {
        return 'k-icon k-icon-form-deployed';
      } else {
        return 'k-icon k-icon-form-draft';
      }
    case ASSET_TYPES.collection.id:
      if (asset.access_types && asset.access_types.includes(ACCESS_TYPES.subscribed)) {
        return 'k-icon k-icon-folder-subscribed';
      } else if (isAssetPublic(asset.permissions)) {
        return 'k-icon k-icon-folder-public';
      } else if (asset.access_types && asset.access_types.includes(ACCESS_TYPES.shared)) {
        return 'k-icon k-icon-folder-shared';
      } else {
        return 'k-icon k-icon-folder';
      }
    default:
      return 'k-icon k-icon-form';
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
    asset: asset,
  });
}

/**
 * Opens a modal for sharing asset.
 * @param {Object} asset - BE asset data
 */
export function share(asset) {
  stores.pageState.showModal({
    type: MODAL_TYPES.SHARING,
    assetid: asset.uid,
  });
}

/**
 * Opens a modal for modifying asset languages and translation strings.
 * @param {Object} asset - BE asset data
 */
export function editLanguages(asset) {
  stores.pageState.showModal({
    type: MODAL_TYPES.FORM_LANGUAGES,
    asset: asset,
  });
}

/**
 * Opens a modal for modifying asset tags (also editable in Details Modal).
 * @param {Object} asset - BE asset data
 */
export function editTags(asset) {
  stores.pageState.showModal({
    type: MODAL_TYPES.ASSET_TAGS,
    asset: asset,
  });
}

/**
 * Opens a modal for replacing an asset using a file.
 * @param {Object} asset - BE asset data
 */
export function replaceForm(asset) {
  stores.pageState.showModal({
    type: MODAL_TYPES.REPLACE_PROJECT,
    asset: asset,
  });
}

/**
 * NOTE: this works based on a fact that all questions have unique names
 * @param {Array<object>} survey - from asset's `content.survey`
 * @param {boolean} [includeGroups] wheter to put groups into output
 * @param {boolean} [includeMeta] - whether to include meta question types (false on default)
 * @returns {object} a pair of quesion names and their full paths
 */
export function getSurveyFlatPaths(survey, includeGroups = false, includeMeta = false) {
  const output = {};
  const openedGroups = [];

  survey.forEach((row) => {
    const rowName = getRowName(row);
    if (typeof GROUP_TYPES_BEGIN[row.type] !== 'undefined') {
      openedGroups.push(rowName);
      if (includeGroups) {
        output[rowName] = openedGroups.join('/');
      }
    } else if (typeof GROUP_TYPES_END[row.type] !== 'undefined') {
      openedGroups.pop();
    } else if (
      QUESTION_TYPES[row.type] ||
      row.type === SCORE_ROW_TYPE ||
      row.type === RANK_LEVEL_TYPE ||
      (includeMeta && META_QUESTION_TYPES[row.type])
    ) {
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
 * @param {object} row
 * @returns {string}
 */
export function getRowName(row) {
  return row.name || row.$autoname || row.$kuid;
}

/**
 * @param {string} rowName - could be either a survey row name or choices row name
 * @param {Array<object>} data - should be either a survey or choices of asset
 * @param {number} translationIndex
 * @returns {string|null} null for not found
 */
export function getTranslatedRowLabel(rowName, data, translationIndex) {
  let foundRowIndex;
  let foundRow;

  data.forEach((row, rowIndex) => {
    if (getRowName(row) === rowName) {
      foundRow = row;
      foundRowIndex = rowIndex;
    }
  });

  if (Object.prototype.hasOwnProperty.call(foundRow, 'label')) {
    return getRowLabelAtIndex(foundRow, translationIndex);
  } else {
    // that mysterious row always comes as a next row
    let possibleRow = data[foundRowIndex + 1];
    if (isRowSpecialLabelHolder(foundRow, possibleRow)) {
      return getRowLabelAtIndex(possibleRow, translationIndex);
    }
  }

  return null;
}

/**
 * If a row doesn't have a label it is very possible that this is
 * a complex type of form item (e.g. ranking, matrix) that was constructed
 * as a group and a row by Backend. This function detects if this is the case.
 * @param {object} mainRow
 * @param {object} holderRow
 * @returns {boolean}
 */
export function isRowSpecialLabelHolder(mainRow, holderRow) {
  if (!mainRow || !holderRow || !Object.prototype.hasOwnProperty.call(holderRow, 'label')) {
    return false;
  } else {
    let mainRowName = getRowName(mainRow);
    let holderRowName = getRowName(holderRow);
    return (
      (
        // this handles ranking questions
        holderRowName === `${mainRowName}_label` &&
        holderRow.type === QUESTION_TYPES.note.id
      ) ||
      (
        // this handles matrix questions (partially)
        holderRowName === `${mainRowName}_note` &&
        holderRow.type === QUESTION_TYPES.note.id
      ) ||
      (
        // this handles rating questions
        holderRowName === `${mainRowName}_header` &&
        holderRow.type === QUESTION_TYPES.select_one.id // rating
      )
    );
  }
}

/**
 * An internal helper function for DRY code
 * @param {object} row
 * @param {number} index
 * @returns {string} label
 */
function getRowLabelAtIndex(row, index) {
  if (Array.isArray(row.label)) {
    return row.label[index];
  } else {
    return row.label;
  }
}

/**
 * @param {string} type - one of QUESTION_TYPES
 * @returns {Node|null}
 */
export function renderQuestionTypeIcon(type) {
  let typeDef;
  if (type === SCORE_ROW_TYPE) {
    typeDef = QUESTION_TYPES.score;
  } else if (type === RANK_LEVEL_TYPE) {
    typeDef = QUESTION_TYPES.rank;
  } else {
    typeDef = QUESTION_TYPES[type];
  }

  if (type === META_QUESTION_TYPES['background-audio']) {
    typeDef = {icon: 'k-icon-qt-audio'};
  } else if (META_QUESTION_TYPES[type]) {
    typeDef = {icon: 'qt-meta-default'};
  }

  if (typeDef) {
    return (<i className={`k-icon k-icon-${typeDef.icon}`} title={type}/>);
  } else {
    return null;
  }
}

/**
 * Use this to get a nice parsed list of survey questions (optionally with meta
 * questions included). Useful when you need to render form questions to users.
 *
 * @param {Object} survey
 * @param {number} [translationIndex] - defaults to first (default) language
 * @param {boolean} [includeMeta] - whether to include meta question types (false on default)
 * @returns {Array<object>} a list of parsed questions
 */
export function getFlatQuestionsList(survey, translationIndex = 0, includeMeta = false) {
  const flatPaths = getSurveyFlatPaths(survey, false, true);
  const output = [];
  const openedGroups = [];
  let openedRepeatGroupsCount = 0;
  survey.forEach((row) => {
    if (row.type === 'begin_group' || row.type === 'begin_repeat') {
      openedGroups.push(getQuestionOrChoiceDisplayName(row, translationIndex));
    }
    if (row.type === 'end_group' || row.type === 'end_repeat') {
      openedGroups.pop();
    }

    if (row.type === 'begin_repeat') {
      openedRepeatGroupsCount++;
    } else if (row.type === 'end_repeat') {
      openedRepeatGroupsCount--;
    }

    if (
      QUESTION_TYPES[row.type] ||
      (includeMeta && META_QUESTION_TYPES[row.type])
    ) {
      const rowName = getRowName(row);
      output.push({
        type: row.type,
        name: rowName,
        isRequired: Boolean(row.required),
        label: getQuestionOrChoiceDisplayName(row, translationIndex),
        path: flatPaths[rowName],
        parents: openedGroups.slice(0),
        hasRepatParent: openedRepeatGroupsCount >= 1,
      });
    }
  });

  return output;
}

/**
 * Validates asset data to see if ready to be made public.
 * NOTE: currently we assume the asset type is `collection`.
 *
 * @param {object} asset
 *
 * @returns {string[]} array of errors (empty array means no errors)
 */
export function isAssetPublicReady(asset) {
  const errors = [];

  if (asset.asset_type === ASSET_TYPES.collection.id) {
    if (!asset.name || !asset.settings.organization || !asset.settings.sector) {
      errors.push(t('Name, organization and sector are required to make collection public.'));
    }
    if (asset.children.count === 0) {
      errors.push(t('Empty collection is not allowed to be made public.'));
    }
  } else {
    errors.push(t('Only collections are allowed to be made public!'));
  }

  return errors;
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
      perm.permission === permConfig.getPermissionByCodename(PERMISSIONS_CODENAMES.discover_asset).url
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

/*
* Inspired by https://gist.github.com/john-doherty/b9195065884cdbfd2017a4756e6409cc
* Remove everything forbidden by XML 1.0 specifications, plus the unicode replacement character U+FFFD
* @param {string} str
*/
export function removeInvalidChars(str) {
  var regex = /((?:[\0-\x08\x0B\f\x0E-\x1F\uFFFD\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]))/g;
  return str = String(str || '').replace(regex, '');
}

export default {
  buildAssetUrl,
  cleanupTags,
  editLanguages,
  editTags,
  getAssetDisplayName,
  getAssetIcon,
  getAssetOwnerDisplayName,
  getCountryDisplayString,
  getFlatQuestionsList,
  getLanguageIndex,
  getLanguagesDisplayString,
  getOrganizationDisplayString,
  getQuestionOrChoiceDisplayName,
  getRowName,
  getSectorDisplayString,
  getSurveyFlatPaths,
  getTranslatedRowLabel,
  isAssetPublic,
  isAssetPublicReady,
  isLibraryAsset,
  isRowSpecialLabelHolder,
  isSelfOwned,
  modifyDetails,
  renderQuestionTypeIcon,
  replaceForm,
  share,
  removeInvalidChars,
};
