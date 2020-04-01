import {getSurveyFlatPaths} from 'js/assetUtils';
import {QUESTION_TYPES} from 'js/constants';

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
  getRepeatGroupAnswers
};
