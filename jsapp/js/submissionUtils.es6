import {
  getRowName,
  getTranslatedRowLabel,
  getSurveyFlatPaths
} from 'js/assetUtils';
import {
  FORM_VERSION_NAME,
  QUESTION_TYPES
} from 'js/constants';

export const DISPLAY_GROUP_TYPES = new Map();
new Set([
  'group_root',
  'group_repeat',
  'group_regular'
]).forEach((codename) => {DISPLAY_GROUP_TYPES.set(codename, codename);});

/**
 * @typedef {Object} DisplayGroup
 * @property {string} type - One of DISPLAY_GROUP_TYPES
 * @property {string} label - Localized display label
 * @property {string} name - Unique identifier
 * @property {Array<DisplayResponse|DisplayGroup>} children - List of groups and responses
 */
class DisplayGroup {
  constructor(type, label = null, name = null) {
    this.type = type;
    this.label = label;
    this.name = name;
    this.children = [];
  }

  /**
   * @property {DisplayResponse|DisplayGroup} child
   */
  addChild(child) {
    this.children.push(child);
  }
}

/**
 * @typedef {Object} DisplayResponse
 * @property {string} type - One of QUESTION_TYPES
 * @property {string} label - Localized display label
 * @property {string} name - Unique identifier
 * @property {string|null} data - User response, `null` for no response
 */
class DisplayResponse {
  constructor(type, label, name, data = null) {
    this.type = type;
    this.label = label;
    this.name = name;
    this.data = data;
  }
}

/**
 * @param {object} submissionData
 * @param {Array<object>} survey
 * @param {number} translationIndex - for choosing label to display
 * @returns {Array<DisplayResponse|DisplayGroup>}
 */
export function getSubmissionDisplayData(survey, translationIndex, submissionData) {
  const flatPaths = getSurveyFlatPaths(survey, true);

  // let's start with a root of survey being a group with special flag
  const output = new DisplayGroup(DISPLAY_GROUP_TYPES.get('group_root'));

  /**
   * recursively generates a nested architecture of survey with data
   * @param {DisplayGroup} parentGroup
   * @param {object} parentData
   * @param {number} [surveyStartIndex] where to start the iteration, useful for groups
   * @param {number} [repeatIndex] inside a repeat group this is the current repeat submission index
   */
  function traverseSurvey(parentGroup, parentData, surveyStartIndex = 0, repeatIndex = null) {
    for (let rowIndex = surveyStartIndex; rowIndex < survey.length; rowIndex++) {
      const row = survey[rowIndex];

      const rowName = getRowName(row);
      const rowLabel = getTranslatedRowLabel(rowName, survey, translationIndex);

      let parentGroupPath = null;
      if (parentGroup.name !== null) {
        parentGroupPath = flatPaths[parentGroup.name];
      }

      let isRowCurrentLevel = isRowFromCurrentGroupLevel(
        rowName,
        parentGroupPath,
        survey
      );

      // we are interested only in questions from this group level
      if (!isRowCurrentLevel) {
        continue;
      }
      // we don't want to include special calculate row used to store form version
      if (row.type === QUESTION_TYPES.get('calculate').id && rowName === FORM_VERSION_NAME) {
        continue;
      }
      // notes don't carry submission data, we ignore them
      if (row.type === QUESTION_TYPES.get('note').id) {
        continue;
      }
      /*
       * For a complex form items (e.g. ranking) Backend constructs a pair of
       * group and a row. The row serves a purpose of a label and we don't want
       * it here as `getTranslatedRowLabel` handles this already.
       */
      let previousRow = survey[rowIndex - 1];
      let previousRowName = previousRow ? getRowName(previousRow) : undefined;
      if (
        previousRow &&
        !Object.prototype.hasOwnProperty.call(previousRow, 'label') &&
        (
          rowName === `${previousRowName}_label` &&
          row.type === QUESTION_TYPES.get('note').id
        ) ||
        (
          rowName === `${previousRowName}_header` &&
          row.type === QUESTION_TYPES.get('select_one').id
        )
      ) {
        continue;
      }

      let rowData = getRowData(rowName, survey, parentData);

      if (row.type === 'begin_repeat') {
        // function to get number of repeat instances here?
        if (Array.isArray(rowData)) {
          rowData.forEach((item, itemIndex) => {
            let repeatObj = new DisplayGroup(
              DISPLAY_GROUP_TYPES.get('group_repeat'),
              rowLabel,
              rowName
            );
            parentGroup.addChild(repeatObj);
            // for a group start whole process again,
            // begin at this place in survey with group as parent element
            traverseSurvey(repeatObj, item, rowIndex + 1, itemIndex);
          });
        }
      } else if (row.type === 'begin_group') {
        let rowObj = new DisplayGroup(
          DISPLAY_GROUP_TYPES.get('group_regular'),
          rowLabel,
          rowName,
        );
        parentGroup.addChild(rowObj);
        // for a group start whole process again,
        // begin at this place in survey with group as parent element
        traverseSurvey(rowObj, rowData, rowIndex + 1, repeatIndex);
      } else if (QUESTION_TYPES.has(row.type)) {
        // for repeat groups, we are interested in current repeat item's data
        if (Array.isArray(rowData) && repeatIndex !== null) {
          rowData = rowData[repeatIndex];
        }

        // for a response, add it as a child of current group
        let rowObj = new DisplayResponse(
          row.type,
          rowLabel,
          rowName,
          rowData
        );
        parentGroup.addChild(rowObj);
      }
    }
  }
  traverseSurvey(output, submissionData);

  console.log(output.children);

  return output;
}

/**
 * Returns data for given row, works for groups too.
 * @param {string} name
 * @param {Array<object>} survey
 * @param {object} data - submission data
 * @returns {string|null|array<*>|object} row data, null is for identifying
 * no answer, array for repeat groups and object for regular groups
 */
function getRowData(name, survey, data) {
  if (data === null || typeof data !== 'object') {
    return null;
  }

  const flatPaths = getSurveyFlatPaths(survey, true);
  const path = flatPaths[name];

  if (data[path]) {
    return data[path];
  } else if (data[name]) {
    return data[name];
  } else if (path) {
    // we don't really know here if this is a repeat or a regular group
    // so we let the data be the guide (possibly not trustworthy)
    let rowData = getRepeatGroupAnswers(data, path);
    if (rowData.length >= 1) {
      return rowData;
    }

    rowData = getRegularGroupAnswers(data, path);
    if (Object.keys(rowData).length >= 1) {
      return rowData;
    }

  }
  return null;
}

/**
 * Tells if given row is an immediate child of given group
 * @param {string} rowName
 * @param {string|null} groupPath - null for root level rows
 * @param {Array<object>} survey
 * @returns {boolean}
 */
function isRowFromCurrentGroupLevel(rowName, groupPath, survey) {
  const flatPaths = getSurveyFlatPaths(survey, true);
  if (groupPath === null) {
    return flatPaths[rowName] === rowName;
  } else {
    return flatPaths[rowName] === `${groupPath}/${rowName}`;
  }
}

/**
 * @param {object} data
 * @param {string} targetKey - with groups e.g. group_person/group_pets/group_pet/pet_name
 * @returns {array} of answers
 */
export function getRepeatGroupAnswers(data, targetKey) {
  const answers = [];

  // Goes through nested groups from key, looking for answers.
  const lookForAnswers = (data, levelIndex) => {
    const levelKey = targetKey.split('/').slice(0, levelIndex + 1).join('/');
    // Each level could be an array of repeat group answers or object with questions.
    if (levelKey === targetKey) {
      if (Object.prototype.hasOwnProperty.call(data, targetKey)) {
        answers.push(data[targetKey]);
      }
    } else if (Array.isArray(data[levelKey])) {
      data[levelKey].forEach((item) => {
        lookForAnswers(item, levelIndex + 1);
      });
    }
  };

  lookForAnswers(data, 0);

  return answers;
}

/**
 * Filters data for items inside the group
 * @param {object} data
 * @param {string} targetKey - with groups e.g. group_person/group_pets/group_pet
 * @returns {object} of answers
 */
function getRegularGroupAnswers(data, targetKey) {
  const answers = {};
  Object.keys(data).forEach((objKey) => {
    if (objKey.startsWith(`${targetKey}/`)) {
      answers[objKey] = data[objKey];
    }
  });
  return answers;
}

export default {
  getSubmissionDisplayData,
  getRepeatGroupAnswers
};
