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

/** Collects all string values from a string or nested string array payload. */
function collectStringValues(value: unknown): string[] {
  if (typeof value === 'string') {
    return [value]
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectStringValues(item))
  }

  return []
}

/** Extracts values wrapped in backticks from a backend validation message. */
function extractBacktickWrappedValues(message: string): string[] {
  return message
    .split('`')
    .filter((_part, index) => index % 2 === 1)
    .map((part) => part.trim())
    .filter(Boolean)
}

/** Returns requested fields that are missing from the backend-provided list of valid fields. */
export function extractInvalidFieldsFromResponseMessage(requestedFields: string[], errorPayload: unknown): string[] {
  if (!errorPayload || typeof errorPayload !== 'object') {
    return []
  }

  const payload = errorPayload as { detail?: unknown; fields?: unknown }
  const candidateMessages = [...collectStringValues(payload.fields), ...collectStringValues(payload.detail)]

  for (const message of candidateMessages) {
    const validFields = extractBacktickWrappedValues(message)

    if (validFields.length === 0) {
      continue
    }

    const validFieldsSet = new Set(validFields)
    return requestedFields.filter((field) => !validFieldsSet.has(field))
  }

  return []
}

/** Builds a user-facing invalid-fields error message from a backend validation response. */
export function buildInvalidFieldsErrorMessage(
  requestedFields: string[],
  errorPayload: unknown,
  prefix: string,
  invalidFieldsLabel: string,
): string | null {
  const invalidFields = extractInvalidFieldsFromResponseMessage(requestedFields, errorPayload)

  if (invalidFields.length === 0) {
    return null
  }

  return `${prefix}. ${invalidFieldsLabel}\n${invalidFields.join('\n')}`
}

export default {
  buildInvalidFieldsErrorMessage,
  extractInvalidFieldsFromResponseMessage,
  generateColumnFilters,
}
