import {
  getRowName,
  getTranslatedRowLabel,
  getSurveyFlatPaths,
  isRowSpecialLabelHolder,
} from 'js/assetUtils';
import {
  createEnum,
  SCORE_ROW_TYPE,
  RANK_LEVEL_TYPE,
  MATRIX_PAIR_PROPS,
  GROUP_TYPES_BEGIN,
  QUESTION_TYPES,
  CHOICE_LISTS,
} from 'js/constants';

export const DISPLAY_GROUP_TYPES = createEnum([
  'group_root',
  'group_repeat',
  'group_regular',
  'group_matrix',
  'group_matrix_row',
]);

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
 * @property {string|undefined} listName - Unique identifier of a choices list,
 *                                         only applicable for question types
 *                                         that uses choices lists
 * @property {string|null} data - User response, `null` for no response
 */
class DisplayResponse {
  constructor(type, label, name, listName, data = null) {
    this.type = type;
    this.label = label;
    this.name = name;
    this.data = data;
    if (listName) {
      this.listName = listName;
    }
  }
}

/**
 * @param {object} submissionData
 * @param {Array<object>} survey
 * @param {Array<object>} choices
 * @param {number} translationIndex - for choosing label to display
 * @returns {DisplayGroup} - a root group with everything inside
 */
export function getSubmissionDisplayData(survey, choices, translationIndex, submissionData) {
  const flatPaths = getSurveyFlatPaths(survey, true);

  // let's start with a root of survey being a group with special flag
  const output = new DisplayGroup(DISPLAY_GROUP_TYPES.group_root);

  /**
   * recursively generates a nested architecture of survey with data
   * @param {DisplayGroup} parentGroup - rows and groups will be added to it as children
   * @param {object} parentData - submissionData scoped by parent (useful for repeat groups)
   * @param {number} [repeatIndex] - inside a repeat group this is the current repeat submission index
   */
  function traverseSurvey(parentGroup, parentData, repeatIndex = null) {
    for (let rowIndex = 0; rowIndex < survey.length; rowIndex++) {
      const row = survey[rowIndex];

      const rowName = getRowName(row);
      let rowListName = getRowListName(row);
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
      // let's hide rows that don't carry any submission data
      if (
        row.type === QUESTION_TYPES.note.id ||
        row.type === QUESTION_TYPES.hidden.id
      ) {
        continue;
      }
      /*
       * For a complex form items (e.g. rating) Backend constructs a pair of
       * group and a row. The row serves a purpose of a label and we don't want
       * it here as `getTranslatedRowLabel` handles this already. We check
       * previous row.
       */
      if (isRowSpecialLabelHolder(survey[rowIndex - 1], row)) {
        continue;
      }

      let rowData = getRowData(rowName, survey, parentData);

      if (row.type === GROUP_TYPES_BEGIN.begin_repeat) {
        if (Array.isArray(rowData)) {
          rowData.forEach((item, itemIndex) => {
            let itemObj = new DisplayGroup(
              DISPLAY_GROUP_TYPES.group_repeat,
              rowLabel,
              rowName
            );
            parentGroup.addChild(itemObj);
            /*
             * Start whole process again starting at this place in survey,
             * with current group as parent element and new repeat index
             * being used.
             */
            traverseSurvey(itemObj, item, itemIndex);
          });
        }
      } else if (row.type === GROUP_TYPES_BEGIN.begin_kobomatrix) {
        let matrixGroupObj = new DisplayGroup(
          DISPLAY_GROUP_TYPES.group_matrix,
          rowLabel,
          rowName,
        );
        parentGroup.addChild(matrixGroupObj);

        if (Array.isArray(choices)) {
          /*
           * For matrixes we generate a group of subgroups - each subgroup
           * corresponds to a matrix item from choices.
           */
          choices.forEach((item) => {
            if (item[MATRIX_PAIR_PROPS.inChoices] === row[MATRIX_PAIR_PROPS.inSurvey]) {
              // Matrix is only one level deep, so we can use a "simpler"
              // non-recursive special function
              populateMatrixData(
                survey,
                choices,
                submissionData,
                translationIndex,
                matrixGroupObj,
                getRowName(item),
                parentData
              );
            }
          });
        }
      } else if (
        row.type === GROUP_TYPES_BEGIN.begin_group ||
        row.type === GROUP_TYPES_BEGIN.begin_score ||
        row.type === GROUP_TYPES_BEGIN.begin_rank
      ) {
        let rowObj = new DisplayGroup(
          DISPLAY_GROUP_TYPES.group_regular,
          rowLabel,
          rowName,
        );
        parentGroup.addChild(rowObj);
        /*
         * Start whole process again starting at this place in survey,
         * with current group as parent element and pass current repeat index.
         */
        traverseSurvey(rowObj, rowData, repeatIndex);
      } else if (
        QUESTION_TYPES[row.type] ||
        row.type === SCORE_ROW_TYPE ||
        row.type === RANK_LEVEL_TYPE
      ) {
        // for repeat groups, we are interested in current repeat item's data
        if (Array.isArray(rowData) && repeatIndex !== null) {
          rowData = rowData[repeatIndex];
        }

        // score and rank don't have list name on them and they need to use
        // the one of their parent
        if (row.type === SCORE_ROW_TYPE || row.type === RANK_LEVEL_TYPE) {
          const parentGroupRow = survey.find((row) =>
            getRowName(row) === parentGroup.name
          );
          rowListName = getRowListName(parentGroupRow);
        }

        let rowObj = new DisplayResponse(
          row.type,
          rowLabel,
          rowName,
          rowListName,
          rowData
        );
        parentGroup.addChild(rowObj);
      }
    }
  }
  traverseSurvey(output, submissionData);

  return output;
}

/**
 * It creates display data structure for a given choice-row of a Matrix.
 * As the data is bit different from all other question types, we need to use
 * a special function, not a great traverseSurvey one.
 * @param {Array<object>} survey
 * @param {Array<object>} choices
 * @param {object} submissionData
 * @param {number} translationIndex
 * @param {DisplayGroup} matrixGroup - a group you want to add a row of questions to
 * @param {string} matrixRowName - the row name
 * @param {object} parentData - submissionData scoped by parent (useful for repeat groups)
 */
function populateMatrixData(
  survey,
  choices,
  submissionData,
  translationIndex,
  matrixGroup,
  matrixRowName,
  parentData
) {
  // create row display group and add it to matrix group
  const matrixRowLabel = getTranslatedRowLabel(matrixRowName, choices, translationIndex);
  let matrixRowGroupObj = new DisplayGroup(
    DISPLAY_GROUP_TYPES.group_matrix_row,
    matrixRowLabel,
    matrixRowName,
  );
  matrixGroup.addChild(matrixRowGroupObj);

  const flatPaths = getSurveyFlatPaths(survey, true);
  const matrixGroupPath = flatPaths[matrixGroup.name];

  /*
   * Iterate over survey rows to find only ones from inside the matrix.
   * These rows are the questions from the target matrix choice-row, so we find
   * all neccessary pieces of data nd build display data structure for it.
   */
  Object.keys(flatPaths).forEach((questionName) => {
    if (flatPaths[questionName].startsWith(`${matrixGroupPath}/`)) {
      const questionSurveyObj = survey.find((row) =>
        getRowName(row) === questionName
      );

      /*
       * NOTE: Submission data for a Matrix question is kept in an unusal
       * property, so instead of:
       * [PATH/]MATRIX/MATRIX_QUESTION
       * it is stored in:
       * [PATH/]MATRIX_CHOICE/MATRIX_CHOICE_QUESTION
       */
      let questionData = null;
      const dataProp = `${matrixGroupPath}_${matrixRowName}/${matrixGroup.name}_${matrixRowName}_${questionName}`;
      if (submissionData[dataProp]) {
        questionData = submissionData[dataProp];
      } else if (parentData[dataProp]) {
        /*
         * If Matrix question is inside a repeat group, the data is stored
         * elsewhere :tableflip:
         */
        questionData = parentData[dataProp];
      }

      let questionObj = new DisplayResponse(
        questionSurveyObj.type,
        getTranslatedRowLabel(questionName, survey, translationIndex),
        questionName,
        getRowListName(questionSurveyObj),
        questionData
      );
      matrixRowGroupObj.addChild(questionObj);
    }
  });
}

/**
 * Returns data for given row, works for groups too.
 * @param {string} name - row name
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

/**
 * @param {object} row
 * @returns {string|undefiend}
 */
function getRowListName(row) {
  return (
    row[CHOICE_LISTS.SELECT] ||
    row[CHOICE_LISTS.MATRIX] ||
    row[CHOICE_LISTS.SCORE] ||
    row[CHOICE_LISTS.RANK]
  );
}

export default {
  DISPLAY_GROUP_TYPES,
  getSubmissionDisplayData,
  getRepeatGroupAnswers,
};
