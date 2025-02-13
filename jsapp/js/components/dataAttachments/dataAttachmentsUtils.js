import assetUtils from 'js/assetUtils';

/* Figure out what columns need to be 'checked' or 'unchecked'
 *
 * @param {Array} selectedColumns - the columns that are already selected
 * @param {Array} selectableQuestions - the questions that are allowed to be exposed
 */
export function generateColumnFilters(selectedColumns, selectableQuestions) {
  let selectableColumns = [];

  // We need to flatten questions if coming from survey in order to compare
  // to `selectableQuestions`
  if (selectableQuestions?.length && typeof selectableQuestions[0] === 'object') {
    let questions = assetUtils.getSurveyFlatPaths(selectableQuestions);
    for (const key in questions) {
      if (!questions[key].includes('version')) {
        selectableColumns.push(questions[key]);
      }
    }
  } else {
    selectableColumns = selectableQuestions;
  }

  const columnsToDisplay = [];
  // Columns are unchecked by default to avoid exposing new questions if user
  // has selected `Share some questions`
  if (selectedColumns.length == 0) {
    selectableColumns.forEach((column) => {
      columnsToDisplay.push({label: column, checked: false});
    });
  } else {
    selectableColumns.forEach((column) => {
      // 'Check' only matching columns
      columnsToDisplay.push({
        label: column,
        checked: selectedColumns.includes(column),
      });
    });
  }
  return columnsToDisplay;
}

export default {
  generateColumnFilters,
};
