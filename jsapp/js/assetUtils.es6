import {actions} from './actions';
import {QUESTION_TYPES} from 'js/constants';

/**
 * NOTE: this works under a true assumption that all questions have unique names
 * @param {object} survey
 * @param {boolean} [includeGroups] wheter to put groups into output
 * @returns {object} a pair of quesion names and their full paths
 */
export function getSurveyFlatPaths(survey, includeGroups = false) {
  const output = {};
  const openedGroups = [];

  survey.forEach((row) => {
    const rowName = getRowName(row);

    if (row.type === 'begin_group' || row.type === 'begin_repeat') {
      openedGroups.push(row.name || row.$autoname);
      if (includeGroups) {
        output[rowName] = openedGroups.join('/');
      }
    }
    if (row.type === 'end_group' || row.type === 'end_repeat') {
      openedGroups.pop();
    }

    if (QUESTION_TYPES.has(row.type)) {
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
 * @param {array|string} label
 * @param {number} translationIndex
 * @returns {string}
 */
export function getTranslatedRowLabel(label, translationIndex) {
  if (Array.isArray(label)) {
    return label[translationIndex];
  } else {
    return label;
  }
}

/**
 * Moves asset to a non-nested collection.
 * @param {string} assetUid
 * @param {string} collectionId
 */
export function moveToCollection(assetUid, collectionId) {
  actions.resources.updateAsset(
    assetUid,
    {parent: `/api/v2/collections/${collectionId}/`}
  );
}

export default {
  getSurveyFlatPaths,
  moveToCollection
};
