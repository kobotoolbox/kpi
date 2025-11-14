import assetUtils from '#/assetUtils'
import type { SurveyRow } from '#/dataInterface'

export interface ColumnFilter {
  label: string
  checked: boolean
}

/* Figure out what columns need to be 'checked' or 'unchecked'
 *
 * @param {Array} selectedColumns - the columns that are already selected
 * @param {Array} selectableQuestions - the questions that are allowed to be exposed
 */
export function generateColumnFilters(selectedColumns: string[], selectableQuestions: any | SurveyRow[]) {
  let selectableColumns: string[] = []

  // We need to flatten questions if coming from survey in order to compare
  // to `selectableQuestions`
  // TODO: for some reason we are safeguarding in case we get array of non objects, but it should always be SurveyRow[], no?
  if (selectableQuestions?.length && typeof selectableQuestions[0] === 'object') {
    const questions = assetUtils.getSurveyFlatPaths(selectableQuestions)
    for (const key in questions) {
      if (!questions[key].includes('version')) {
        selectableColumns.push(questions[key])
      }
    }
  } else {
    selectableColumns = selectableQuestions
  }

  const columnsToDisplay: ColumnFilter[] = []
  // Columns are unchecked by default to avoid exposing new questions if user
  // has selected `Share some questions`
  if (selectedColumns.length == 0) {
    selectableColumns.forEach((column) => {
      columnsToDisplay.push({ label: column, checked: false })
    })
  } else {
    selectableColumns.forEach((column) => {
      // 'Check' only matching columns
      columnsToDisplay.push({
        label: column,
        checked: selectedColumns.includes(column),
      })
    })
  }
  return columnsToDisplay
}

export default {
  generateColumnFilters,
}
