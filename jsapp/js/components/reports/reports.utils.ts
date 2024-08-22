import type {SurveyRow} from 'js/dataInterface';
import type {ReportsResponse, ReportsPaginatedResponse} from './reportsConstants';

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
