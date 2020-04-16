import {actions} from './actions';
import {QUESTION_TYPES} from 'js/constants';

/**
 * NOTE: this works under a true assumption that all questions have unique names
 * @param {Array<object>} survey
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
 * @param {string} rowName
 * @param {Array<object>} survey
 * @param {number} translationIndex
 * @returns {string|null} null for not found
 */
export function getTranslatedRowLabel(rowName, survey, translationIndex) {
  let foundRow = survey.find((row) => {
    return getRowName(row) === rowName;
  });

  if (Object.prototype.hasOwnProperty.call(foundRow, 'label')) {
    if (Array.isArray(foundRow.label)) {
      return foundRow.label[translationIndex];
    } else {
      return foundRow.label;
    }
  } else {
    /*
     * if a row doesn't have a label
     * it is possible this is a complex type of form item (e.g. ranking, matrix)
     * that was rendered as a group and a note in resulted Backend survey
     */
    let foundNoteRow = survey.find((row) => {
      return getRowName(row) === `${rowName}_label` && row.type === QUESTION_TYPES.get('note').id;
    });

    if (foundNoteRow && Object.prototype.hasOwnProperty.call(foundNoteRow, 'label')) {
      if (Array.isArray(foundNoteRow.label)) {
        return foundNoteRow.label[translationIndex];
      } else {
        return foundNoteRow.label;
      }
    }
  }

  return null;
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
