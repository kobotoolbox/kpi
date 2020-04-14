import {
  getRowName,
  getTranslatedRowLabel,
  getSurveyFlatPaths
} from 'js/assetUtils';
import {QUESTION_TYPES} from 'js/constants';

const DISPLAY_GROUP_TYPES = new Map();
new Set([
  'root',
  'repeat',
  'regular'
]).forEach((codename) => {DISPLAY_GROUP_TYPES.set(codename, codename);});

/**
 * @typedef {Object} DisplayGroup
 * @property {string} type - One of DISPLAY_GROUP_TYPES
 * @property {string} label - Localized display label
 * @property {string} name - Unique identifier
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
 * @param {object} survey
 * @param {number} translationIndex - for choosing label to display
 * @returns {Array<DisplayResponse|DisplayGroup>}
 */
export function getSubmissionDisplayData(survey, translationIndex, submissionData) {
  const flatPaths = getSurveyFlatPaths(survey, true);

  // let's start with a root of survey being a group with special flag
  const output = new DisplayGroup(DISPLAY_GROUP_TYPES.get('root'));

  /**
   * recursively generates a nested architecture of survey with data
   * @param {DisplayGroup} parentGroup
   * @param {number} surveyStartIndex
   * @param {number} dataIndex
   */
  function traverseSurvey(parentGroup, surveyStartIndex, dataIndex = null) {
    for (let i = surveyStartIndex; i < survey.length; i++) {
      const row = survey[i];

      const rowName = getRowName(row);
      const rowLabel = getTranslatedRowLabel(row.label, translationIndex);

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

      if (row.type === 'begin_repeat') {
        const repeatData = getRowData(rowName, survey, submissionData);
        if (Array.isArray(repeatData)) {
          repeatData.forEach((item, itemIndex) => {
            let repeatObj = new DisplayGroup(
              DISPLAY_GROUP_TYPES.get('repeat'),
              rowLabel,
              rowName
            );
            parentGroup.addChild(repeatObj);
            // for a group start whole process again,
            // begin at this place in survey with group as parent element
            traverseSurvey(repeatObj, i + 1, itemIndex);
          });
        }
      } else if (row.type === 'begin_group') {
        let rowObj = new DisplayGroup(
          DISPLAY_GROUP_TYPES.get('regular'),
          rowLabel,
          rowName,
        );
        parentGroup.addChild(rowObj);
        // for a group start whole process again,
        // begin at this place in survey with group as parent element
        traverseSurvey(rowObj, i + 1, dataIndex);
      } else if (QUESTION_TYPES.has(row.type)) {
        let rowData = getRowData(rowName, survey, submissionData);
        // for repeat groups, we are interested in current repeat item's data
        if (Array.isArray(rowData) && dataIndex !== null) {
          rowData = rowData[dataIndex];
        }

        // for a resonse, add is as a child of current group
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
  traverseSurvey(output, 0);

  console.log(output.children);

  return output;
}

/**
 * HELPER FUNCTION
 * @param {string} name
 * @param {object} survey
 * @param {object} data - submission data
 * @returns {string|null|array<*>} row data, null is for identifying no answer, array for repeat groups
 */
function getRowData(name, survey, data) {
  const flatPaths = getSurveyFlatPaths(survey, true);
  const path = flatPaths[name];
  if (data[path]) {
    return data[path];
  } else if (data[name]) {
    return data[name];
  } else if (path) {
    let rowData = getRepeatGroupAnswers(data, path);
    if (rowData.length >= 1) {
      return rowData;
    }
  }
  return null;
}

/**
 * HELPER FUNCTION
 * @param {string} rowName
 * @param {string|null} groupName
 * @param {object} survey
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
