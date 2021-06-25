import {
  SUBMISSION_ACTIONS_ID,
  VALIDATION_STATUS_ID_PROP,
} from './tableConstants';

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
  question,
  questionPath,
  showGroupName,
  translationIndex = 0
) {
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
