import {META_QUESTION_TYPES} from 'js/constants';
import {
  SUBMISSION_ACTIONS_ID,
  VALIDATION_STATUS_ID_PROP,
} from 'js/components/submissions/tableConstants';

/**
 * @param {object[]} survey
 * @param {string} key - column id/question name
 * @param {object} question - question
 * @param {string[]} questionPath - question name with parent groups
 * @param {boolean} showGroupName
 * @param {number} [translationIndex=0]
 * @returns {string}
 */
export function getColumnLabel(
  survey,
  key,
  showGroupName,
  translationIndex = 0
) {
  var question;
  var questionPath = [];
  if (key.includes('/')) {
    questionPath = key.split('/');
    question = survey.find((o) => (
      o.name === questionPath[questionPath.length - 1] ||
      o.$autoname === questionPath[questionPath.length - 1]
    ));
  } else {
    question = survey.find((o) => o.name === key || o.$autoname === key);
  }

  // NOTE: Some very old code has something to do with nonexistent/negative
  // translationIndex. No idea what is that. It does influences returned value.
  const showLabels = translationIndex > -1;

  if (key === SUBMISSION_ACTIONS_ID) {
    return t('Multi-select checkboxes column');
  }
  if (key === VALIDATION_STATUS_ID_PROP) {
    return t('Validation status');
  }

  var label = key;

  if (key.includes('/')) {
    var splitK = key.split('/');
    label = splitK[splitK.length - 1];
  }
  if (question && question.label && showLabels && question.label[translationIndex]) {
    label = question.label[translationIndex];
  }
  // show Groups in labels, when selected
  if (showGroupName && questionPath && key.includes('/')) {
    var gLabels = questionPath.join(' / ');

    if (showLabels) {
      var gT = questionPath.map(function (g) {
        var x = survey.find((o) => o.name === g || o.$autoname === g);
        if (x && x.label && x.label[translationIndex]) {
          return x.label[translationIndex];
        }

        return g;
      });
      gLabels = gT.join(' / ');
    }
    return gLabels;
  }

  return label;
}

/**
 * @param {string} key - column id/question name
 * @returns {string} given column's HXL tags
 */
export function getColumnHXLTags(survey, key) {
  const colQuestion = survey.find((question) =>
    question.$autoname === key
  );
  if (!colQuestion || !colQuestion.tags) {
    return null;
  }
  const HXLTags = [];
  colQuestion.tags.forEach((tag) => {
    if (tag.startsWith('hxl:')) {
      HXLTags.push(tag.replace('hxl:', ''));
    }
  });
  if (HXLTags.length === 0) {
    return null;
  } else {
    return HXLTags.join('');
  }
}

/**
 * TODO: if multiple background-audio's are allowed, we should return all
 * background-audio related names
 * @param {object} asset
 * @returns {string|null}
 */
export function getBackgroundAudioQuestionName(asset) {
  return asset?.content?.survey.find(
    (item) => item.type === META_QUESTION_TYPES['background-audio']
  )?.name || null;
}
