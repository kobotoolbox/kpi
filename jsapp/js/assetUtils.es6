/**
 * @param {string} questionName
 * @param {object} survey
 * @returns {string} a full path including all group names
 */
export function getQuestionPath(questionName, survey) {
  const groups = {};
  let currentGroup = null;

  survey.forEach((surveyItem) => {
    if (surveyItem.type === 'end_group') {
      currentGroup = null;
    }

    if (currentGroup !== null) {
      groups[currentGroup].push(surveyItem.name || surveyItem.$autoname);
    }

    if (surveyItem.type === 'begin_group') {
      currentGroup = surveyItem.name;
      groups[currentGroup] = [];
    }
  });

  let path = questionName;

  Object.keys(groups).forEach((group) => {
    if(groups[group].includes(path)) {
      path = `${group}/${path}`;
    }
  });

  return path;
}

export default {
  getQuestionPath
};
