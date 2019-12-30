import {QUESTION_TYPES} from 'js/constants';

/**
 * @param {object} survey
 * @returns {object} a pair of quesion names and their full paths
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

export const assetUtils = {
  getSurveyFlatPaths
};
