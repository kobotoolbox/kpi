import React from 'react';
import {actions} from './actions';
import {
  GROUP_TYPES_BEGIN,
  GROUP_TYPES_END,
  QUESTION_TYPES,
  SCORE_ROW_TYPE,
  RANK_LEVEL_TYPE
} from 'js/constants';

/**
 * NOTE: this works under a true assumption that all questions have unique names
 * @param {Array<object>} survey - from asset's `content.survey`
 * @param {boolean} [includeGroups] wheter to put groups into output
 * @returns {object} a pair of quesion names and their full paths
 */
export function getSurveyFlatPaths(survey, includeGroups = false) {
  const output = {};
  const openedGroups = [];

  survey.forEach((row) => {
    const rowName = getRowName(row);
    if (GROUP_TYPES_BEGIN.has(row.type)) {
      openedGroups.push(rowName);
      if (includeGroups) {
        output[rowName] = openedGroups.join('/');
      }
    } else if (GROUP_TYPES_END.has(row.type)) {
      openedGroups.pop();
    } else if (
      QUESTION_TYPES.has(row.type) ||
      row.type === SCORE_ROW_TYPE ||
      row.type === RANK_LEVEL_TYPE
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
        holderRow.type === QUESTION_TYPES.get('note').id
      ) ||
      (
        // this handles matrix questions (partially)
        holderRowName === `${mainRowName}_note` &&
        holderRow.type === QUESTION_TYPES.get('note').id
      ) ||
      (
        // this handles rating questions
        holderRowName === `${mainRowName}_header` &&
        holderRow.type === QUESTION_TYPES.get('select_one').id // rating
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
 * @returns {Node}
 */
export function renderTypeIcon(type, additionalClassNames = []) {
  let typeDef;
  if (type === SCORE_ROW_TYPE) {
    typeDef = QUESTION_TYPES.get('score');
  } else if (type === RANK_LEVEL_TYPE) {
    typeDef = QUESTION_TYPES.get('rank');
  } else {
    typeDef = QUESTION_TYPES.get(type);
  }

  if (typeDef) {
    const classNames = additionalClassNames;
    classNames.push('fa');
    classNames.push(typeDef.faIcon);
    return (<i className={classNames.join(' ')} title={type}/>);
  } else {
    return <small><code>{type}</code></small>;
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
  getSurveyFlatPaths,
  getRowName,
  getTranslatedRowLabel,
  isRowSpecialLabelHolder,
  renderTypeIcon,
  moveToCollection,
  removeInvalidChars
};
