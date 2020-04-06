import {getSurveyFlatPaths} from 'js/assetUtils';
import {QUESTION_TYPES} from 'js/constants';

/**
 * @typedef {Object} DisplayResponse
 * @property {string} label - Localized display label
 * @property {string} name - Unique identifier
 * @property {string} type - One of QUESTION_TYPES
 * @property {string|null} data - User response, `null` for no response
 */

/**
 * @typedef {Object} DisplayGroup
 * @property {string} label - Localized display label
 * @property {string} name - Unique identifier
 * @property {boolean} isRepeat - Wheter this is a repeat group
 * @property {Array<DisplayResponse|DisplayGroup>} children - Responses or other groups
 */

class DisplayGroup {
  constructor(label = null, name = null, isRepeat = false) {
    this.label = label;
    this.name = name;
    this.isRepeat = isRepeat;
    this.children = [];
  }

  addChild(child) {
    this.children.push(child);
  }
}

class DisplayResponse {
  constructor(label, name, type, data = null) {
    this.label = label;
    this.name = name;
    this.type = type;
    this.data = data;
  }
}

/**
 * @param {object} submissionData
 * @param {object} survey
 * @param {number} translationIndex - for choosing label to display
 * @returns {Array<DisplayResponse|DisplayGroup>}
 */
export function getSubmissionDisplayData(survey, translationIndex, submissionData) {
  // needed for laters
  const flatPaths = getSurveyFlatPaths(survey);
  console.log('flatPaths:');
  console.log(flatPaths);

  // let's start with a root of survey being a group with special flag
  const output = new DisplayGroup();
  output.isRoot = true;

  // recursively generates a nested architecture of survey with data
  function traverseSurvey(parentGroup, surveyStartIndex) {
    for (let i = surveyStartIndex; i < survey.length; i++) {
      const row = survey[i];

      const rowName = getRowName(row);
      const rowLabel = getTranslatedRowLabel(row.label, translationIndex);
      let isRowCurrentLevel = isRowFromCurrentGroupLevel(
        rowName,
        parentGroup.name,
        survey
      );

      if (row.type === 'begin_group' || row.type === 'begin_repeat') {
        let rowObj = new DisplayGroup(
          rowLabel,
          rowName,
          row.type === 'begin_repeat'
        );
        parentGroup.addChild(rowObj);
        // for a group start whole process again,
        // begin at this place in survey with group as parent element
        traverseSurvey(rowObj, i + 1);
      } else if (QUESTION_TYPES.has(row.type) && isRowCurrentLevel) {
        // for a resonse, add is as a child of current group
        let rowObj = new DisplayResponse(
          rowLabel,
          rowName,
          row.type,
          getRowData(rowName, survey, submissionData)
        );
        parentGroup.addChild(rowObj);
      }
    }
  }
  traverseSurvey(output, 0);

  console.log('traversed:');
  console.log(output);

  return output;
}

/**
 * HELPER FUNCTION
 * @param {string} name
 * @param {object} survey
 * @param {object} data - submission data
 * @returns {*} row data
 */
function getRowData(name, survey, data) {
  const flatPaths = getSurveyFlatPaths(survey);
  const path = flatPaths[name];
  let rowData;
  if (data[path]) {
    rowData = data[path];
  } else if (data[name]) {
    rowData = data[name];
  } else if (path) {
    rowData = getRepeatGroupAnswers(data, path);
  }
  return rowData;
}

/**
 * HELPER FUNCTION
 * @param {object} row
 * @returns {string}
 */
function getRowName(row) {
  return row.name || row.$autoname || row.$kuid;
}

/**
 * HELPER FUNCTION
 * @param {array|string} label
 * @param {number} translationIndex
 * @returns {string}
 */
function getTranslatedRowLabel(label, translationIndex) {
  if (Array.isArray(label)) {
    return label[translationIndex];
  } else {
    return label;
  }
}

/**
 * HELPER FUNCTION
 * @param {string} rowName
 * @param {string|null} groupName
 * @param {object} survey
 * @returns {boolean}
 */
function isRowFromCurrentGroupLevel(rowName, groupName, survey) {
  const flatPaths = getSurveyFlatPaths(survey);
  if (groupName === null) {
    return flatPaths[rowName] === rowName;
  } else {
    return flatPaths[rowName] === `${groupName}/${rowName}`;
  }
}

/**
 * @param {object} submissionData
 * @param {string} targetKey - with groups e.g. group_person/group_pets/group_pet/pet_name
 * @returns {array} of answers
 */
export function getRepeatGroupAnswers(submissionData, targetKey) {
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

  lookForAnswers(submissionData, 0);

  return answers;
}

export default {
  getSubmissionDisplayData,
  getRepeatGroupAnswers
};
