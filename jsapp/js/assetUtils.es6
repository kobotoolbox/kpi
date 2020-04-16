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
      openedGroups.push(rowName);
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
  let foundRowIndex;
  let foundRow;

  survey.forEach((row, rowIndex) => {
    if (getRowName(row) === rowName) {
      foundRow = row;
      foundRowIndex = rowIndex;
    }
  });

  if (Object.prototype.hasOwnProperty.call(foundRow, 'label')) {
    return getRowLabelAtIndex(foundRow, translationIndex);
  } else {
    /*
     * If a row doesn't have a label it is very possible that this is
     * a complex type of form item (e.g. ranking, matrix) that was constructed
     * as a group and a note (or other row) by Backend.
     */
    let foundRowName = getRowName(foundRow);
    // that mysterious row always comes as a next row
    let possibleRow = survey[foundRowIndex + 1];
    let possibleRowName = possibleRow ? getRowName(possibleRow) : undefined;

    if (
      possibleRow &&
      Object.prototype.hasOwnProperty.call(possibleRow, 'label') &&
      (
        // this handles ranking questions
        possibleRowName === `${foundRowName}_label` &&
        possibleRow.type === QUESTION_TYPES.get('note').id
      ) ||
      (
        // this handles rating questions
        possibleRowName === `${foundRowName}_header` &&
        possibleRow.type === QUESTION_TYPES.get('select_one').id
      )
    ) {
      return getRowLabelAtIndex(possibleRow, translationIndex);
    }
  }

  return null;
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
