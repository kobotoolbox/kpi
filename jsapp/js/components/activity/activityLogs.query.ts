import {keepPreviousData, useQuery} from '@tanstack/react-query';
import type {KoboSelectOption} from 'js/components/common/koboSelect';
import type {FailResponse, PaginatedResponse} from 'js/dataInterface';
import {
  type ActivityLogsItem,
} from './activity.constants';
import {QueryKeys} from 'js/query/queryKeys';
import {fetchGet} from 'jsapp/js/api';
import {endpoints} from 'jsapp/js/api.endpoints';
import type {PaginatedQueryHookParams} from 'jsapp/js/universalTable/paginatedQueryUniversalTable.component';

// =============================================================================
// MOCK DATA GENERATION
const mockOptions: KoboSelectOption[] = [
  {value: '1', label: 'Option 1'},
  {value: '2', label: 'Option 2'},
  {value: '3', label: 'Option 3'},
];

// END OF MOCK GENERATION
// =============================================================================

/**
 * Fetches the activity logs from the server.
 * @param limit Pagination parameter: number of items per page
 * @param offset Pagination parameter: offset of the page
 */
const getActivityLogs = async (projectId: string, limit: number, offset: number) => {
  const params = new URLSearchParams({
    limit: limit.toString(),
    offset: offset.toString(),
  });
  const endpointUrl = endpoints.ASSET_HISTORY.replace(':asset_id', projectId);

  return await fetchGet<PaginatedResponse<ActivityLogsItem>>(`${endpointUrl}?${params}`, {
    errorMessageDisplay: t('There was an error getting one-time add-ons.'),
  });
};

/**
 * Fetches the filter options for the activity logs.
 */
const getFilterOptions = async () =>
  new Promise<KoboSelectOption[]>((resolve) => {
    setTimeout(() => resolve(mockOptions), 1000);
  });

/**
 * Starts the exporting process of the activity logs.
 * @returns {Promise<void>} The promise that starts the export
 */
const startActivityLogsExport = async () =>
  new Promise<void>((resolve, reject) => {
    // Simulates backend export process.
    setTimeout(() => {
      if (Math.random() > 0.5) {
        resolve();
      } else {
        const failResponse: FailResponse = {
          status: 500,
          statusText: 'Mocked error',
        };
        reject(failResponse);
      }
    }, 500);
  });

/**
 * This is a hook that fetches activity logs from the server.
 *
 * @param itemLimit Pagination parameter: number of items per page
 * @param pageOffset Pagination parameter: offset of the page
 */
export const useActivityLogsQuery = ({limit, offset, projectId}: PaginatedQueryHookParams) =>
   useQuery({
    queryKey: [QueryKeys.activityLogs, projectId, limit, offset],
    queryFn: () => getActivityLogs(projectId as string, limit, offset),
    placeholderData: keepPreviousData,
  });

/**
 * This is a hook to fetch the filter options for the activity logs.
 */
export const useActivityLogsFilterOptionsQuery = () =>
  useQuery({
    queryKey: [QueryKeys.activityLogsFilter],
    queryFn: () => getFilterOptions(),
  });

/**
 * This is a hook to start the exporting process of the activity logs.
 * @returns {() => void} The function to start the export
 */
export const useExportActivityLogs = () => startActivityLogsExport;
