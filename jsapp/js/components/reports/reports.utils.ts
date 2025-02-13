// Utils
import {getTranslatedRowLabel} from 'js/assetUtils';

// Types
import type {SurveyRow} from 'js/dataInterface';
import type {
  ReportsResponse,
  ReportsPaginatedResponse,
} from './reportsConstants';

/**
 * This function filters out reports to get only ones with responses. Also makes
 * sure there is a user friendly label.
 */
export function getDataWithResponses(
  rowsByIdentifier: {[identifier: string]: SurveyRow},
  reportsResponseData: ReportsPaginatedResponse
) {
  const dataWithResponses: ReportsResponse[] = [];

  reportsResponseData.list.forEach((item) => {
    if (item.data.responses || item.data.values || item.data.mean) {
      if (rowsByIdentifier[item.name] !== undefined) {
        item.row.label = rowsByIdentifier[item.name].label;
      } else if (item.name !== undefined) {
        item.row.label = item.name;
      } else {
        item.row.label = t('untitled');
      }
      dataWithResponses.push(item);
    }
  });

  return dataWithResponses;
}

export function getReportRowTranslatedLabel(
  report: ReportsResponse,
  /**
   * The `undefined` is for cases where survey is not known (yet). It's easier
   * to handle it here than in each place that is using this function.
   */
  survey: SurveyRow[] | undefined,
  translationIndex: number,
): string {
  let label: string | null = null;

  // Case 1: report has label (as array of translations), and target language
  // translation exists in it
  if (
    !label &&
    Array.isArray(report.row.label) &&
    report.row.label[translationIndex]
  ) {
    label = report.row.label[translationIndex];
  }

  // Case 2: (possibly deprecated/legacy) report has label that is just a string
  if (!label && typeof report.row.label === 'string') {
    label = report.row.label;
  }

  // Case 3: we don't have label yet, we try to get it from the asset object for
  // target language
  if (!label) {
    label = getTranslatedRowLabel(report.name, survey, translationIndex);
  }

  // Case 4: we don't have label yet, we try to get it from the asset object for
  // default language
  if (!label) {
    label = getTranslatedRowLabel(report.name, survey, 0);
  }

  // Return found label or fallback user-friendly name
  // TODO: would XML row name be better here than "Unlabeled"?
  return label || t('Unlabeled');
}
