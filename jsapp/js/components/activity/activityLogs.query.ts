import {keepPreviousData, useQuery} from '@tanstack/react-query';
import type {FailResponse, PaginatedResponse} from 'js/dataInterface';
import {AuditActions, type ActivityLogsItem} from './activity.constants';
import {QueryKeys} from 'js/query/queryKeys';
import {fetchGet} from 'jsapp/js/api';
import {endpoints} from 'jsapp/js/api.endpoints';
import type {PaginatedQueryHookParams} from 'jsapp/js/universalTable/paginatedQueryUniversalTable.component';

/**
 * Fetches the activity logs from the server.
 * @param limit Pagination parameter: number of items per page
 * @param offset Pagination parameter: offset of the page
 */
const getActivityLogs = async ({
  assetUid,
  actionFilter,
  limit,
  offset,
}: {
  assetUid: string;
  actionFilter: string;
  limit: number;
  offset: number;
}) => {
  const params = new URLSearchParams({
    limit: limit.toString(),
    offset: offset.toString(),
  });
  if (actionFilter) {
    params.append('q', `action:${actionFilter}`);
  }

  const endpointUrl = endpoints.ASSET_HISTORY.replace(':asset_uid', assetUid);

  return await fetchGet<PaginatedResponse<ActivityLogsItem>>(
    `${endpointUrl}?${params}`,
    {
      errorMessageDisplay: t('There was an error getting one-time add-ons.'),
    }
  );
};

/**
 * Fetches the filter options for the activity logs.
 *
 * Filter options, for now, comes from ../api/v2/assets/[ assetId]]/history
 * from the 'Filterable fields" section.
 *
 */
const getFilterOptions = async () =>
  (Object.keys(AuditActions) as Array<keyof typeof AuditActions>).sort().map((value) => {
    return {
      label: AuditActions[value],
      value,
    };
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
export const useActivityLogsQuery = ({
  limit,
  offset,
  assetUid,
  actionFilter,
}: PaginatedQueryHookParams) =>
  useQuery({
    queryKey: [QueryKeys.activityLogs, assetUid, actionFilter, limit, offset],
    queryFn: () =>
      getActivityLogs({
        assetUid: assetUid as string,
        actionFilter: actionFilter as string,
        limit,
        offset,
      }),
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
