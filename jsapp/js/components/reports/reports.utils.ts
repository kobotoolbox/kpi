import { getTranslatedRowLabel } from '#/assetUtils'
import type { AssetResponse, SurveyRow } from '#/dataInterface'
import { recordKeys } from '#/utils'
import type {
  AssetResponseReportStyles,
  CustomReportSettings,
  ReportStyle,
  ReportsPaginatedResponse,
  ReportsResponse,
} from './reportsConstants'

/**
 * This function filters out reports to get only ones with responses. Also makes
 * sure there is a user friendly label.
 */
export function getDataWithResponses(
  rowsByIdentifier: { [identifier: string]: SurveyRow },
  reportsResponseData: ReportsPaginatedResponse,
) {
  const dataWithResponses: ReportsResponse[] = []

  reportsResponseData.list.forEach((item) => {
    if (item.data.responses || item.data.values || item.data.mean) {
      if (rowsByIdentifier[item.name] !== undefined) {
        item.row.label = rowsByIdentifier[item.name].label
      } else if (item.name !== undefined) {
        item.row.label = item.name
      } else {
        item.row.label = t('untitled')
      }
      dataWithResponses.push(item)
    }
  })

  return dataWithResponses
}

/**
 * Returns the best available human-readable label for a report row.
 *
 * Fallback order:
 * 1) row label translation at requested index
 * 2) row label as plain string
 * 3) translated label from survey at requested index
 * 4) translated label from survey at index 0
 * 5) generic "Unlabeled"
 */
export function getReportRowTranslatedLabel(
  report: ReportsResponse,
  /**
   * The `undefined` is for cases where survey is not known (yet). It's easier
   * to handle it here than in each place that is using this function.
   */
  survey: SurveyRow[] | undefined,
  translationIndex: number,
): string {
  let label: string | null = null

  // Case 1: report has label (as array of translations), and target language
  // translation exists in it
  if (!label && Array.isArray(report.row.label) && report.row.label[translationIndex]) {
    label = report.row.label[translationIndex]
  }

  // Case 2: (possibly deprecated/legacy) report has label that is just a string
  if (!label && typeof report.row.label === 'string') {
    label = report.row.label
  }

  // Case 3: we don't have label yet, we try to get it from the asset object for
  // target language
  if (!label) {
    label = getTranslatedRowLabel(report.name, survey, translationIndex)
  }

  // Case 4: we don't have label yet, we try to get it from the asset object for
  // default language
  if (!label) {
    label = getTranslatedRowLabel(report.name, survey, 0)
  }

  // Return found label or fallback user-friendly name
  // TODO: would XML row name be better here than "Unlabeled"?
  return label || t('Unlabeled')
}

/**
 * Merges a sparse question-level style override with base report style.
 *
 * This preserves inherited values (for example `report_colors`) when an
 * override only changes one field such as `report_type`.
 */
export function buildEffectiveReportStyle(baseStyle?: ReportStyle, specifiedStyle?: ReportStyle) {
  // Question-level overrides are intentionally partial (e.g. only report_type),
  // so we always merge them on top of the base report style.
  if (!specifiedStyle || !recordKeys(specifiedStyle).length) {
    return baseStyle
  }

  return {
    ...(baseStyle || {}),
    ...specifiedStyle,
  }
}

/**
 * Resolves the effective style for a single row by combining:
 * 1) the active base style (custom report first, otherwise default), and
 * 2) row-level overrides from the matching style map.
 */
export function getEffectiveRowReportStyle(
  rowName: string,
  customReport?: CustomReportSettings,
  defaultReportStyles?: AssetResponseReportStyles,
) {
  const specifiedReportStyles = customReport?.specified?.[rowName] || defaultReportStyles?.specified?.[rowName]
  const baseReportStyle = customReport?.reportStyle || defaultReportStyles?.default

  return buildEffectiveReportStyle(baseReportStyle, specifiedReportStyles)
}

/**
 * Enriches response labels for select questions in-place.
 *
 * Why in-place: report rows are already mutable in this rendering pipeline and
 * downstream components consume these same row objects.
 */
export function populateSelectQuestionLabels(
  reportRow: ReportsResponse,
  asset: AssetResponse,
  translationIndex: number,
  groupBy?: string,
) {
  if (!asset?.content?.choices) {
    return
  }

  const rowName = reportRow.name
  const question = asset.content.survey?.find((z) => z.name === rowName || z.$autoname === rowName)
  const responses = reportRow.data.responses

  if (responses) {
    reportRow.data.responseLabels = responses.map((responseName) => {
      const choice = asset.content?.choices?.find(
        (choiceItem) =>
          question && choiceItem.list_name === question.select_from_list_name && choiceItem.name === responseName,
      )

      return choice?.label?.[translationIndex] || responseName
    })
    return
  }

  const values = reportRow.data.values
  if (!(values?.[0]?.[1] && 'responses' in values[0][1] && values[0][1].responses)) {
    return
  }

  const responseValues = values[0][1].responses
  const groupByQuestion = asset.content.survey?.find((z) => z.name === groupBy || z.$autoname === groupBy)

  reportRow.data.responseLabels = responseValues.map((responseLabel) => {
    const groupByChoice = asset.content?.choices?.find(
      (choiceItem) =>
        groupByQuestion &&
        choiceItem.list_name === groupByQuestion.select_from_list_name &&
        choiceItem.label?.includes(responseLabel),
    )

    return groupByChoice?.label?.[translationIndex] || responseLabel
  })

  for (let valueIndex = values.length - 1; valueIndex >= 0; valueIndex--) {
    const choice = asset.content.choices.find(
      (choiceItem) =>
        question &&
        choiceItem.list_name === question.select_from_list_name &&
        (choiceItem.name === String(values[valueIndex][0]) || choiceItem.$autoname === String(values[valueIndex][0])),
    )

    if (choice?.label?.[translationIndex]) {
      values[valueIndex][2] = choice.label[translationIndex]
    } else {
      values[valueIndex][2] = values[valueIndex][0]
    }
  }
}
