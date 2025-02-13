import {keepPreviousData, useQuery} from '@tanstack/react-query';
import type {
  FailResponse,
  LabelValuePair,
  PaginatedResponse,
} from 'js/dataInterface';
import {AUDIT_ACTION_TYPES, HIDDEN_AUDIT_ACTIONS} from './activity.constants';
import type {AuditActions, ActivityLogsItem} from './activity.constants';
import {QueryKeys} from 'js/query/queryKeys';
import {fetchGet, fetchPost} from 'jsapp/js/api';
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
  // Filter out unwanted actions (e.g. UI doesn't support them yet).
  let q = `NOT action:'${HIDDEN_AUDIT_ACTIONS.join(',')}'`;
  // Alternatively filter by only single selected action.
  if (actionFilter !== '') {
    q = `action:${actionFilter}`;
  }

  const params = new URLSearchParams({
    limit: limit.toString(),
    offset: offset.toString(),
    q: q,
  });

  const endpointUrl = endpoints.ASSET_HISTORY.replace(':asset_uid', assetUid);

  return await fetchGet<PaginatedResponse<ActivityLogsItem>>(
    `${endpointUrl}?${params}`,
    {
      errorMessageDisplay: t('There was an error getting activity logs.'),
    }
  );
};

/**
 * Fetches the filter options for the activity logs.
 *
 * Filter options, for now, comes from AuditActions enum.
 * In the future we might change this to be fetched from the server.
 *
 * Items are sorted by an specific order defined in the AUDIT_ACTION_TYPES.
 *
 */
const getFilterOptions = async (
  assetUid: string
): Promise<LabelValuePair[]> => {
  const endpointUrl = endpoints.ASSET_HISTORY_ACTIONS.replace(
    ':asset_uid',
    assetUid
  );

  const filterOptions = await fetchGet<{
    actions: Array<keyof typeof AuditActions>;
  }>(endpointUrl, {
    errorMessageDisplay: t('There was an error getting the filter options.'),
  });

  return filterOptions.actions
    .map((key) => AUDIT_ACTION_TYPES[key])
    .filter((auditAction) => !HIDDEN_AUDIT_ACTIONS.includes(auditAction.name))
    .sort((a, b) => a.order - b.order)
    .map((auditAction) => {
      return {
        label: auditAction.label,
        value: auditAction.name,
      };
    });
};

/**
 * Starts the exporting process of the activity logs.
 * @returns {Promise<void>} The promise that starts the export
 */
export const startActivityLogsExport = (assetUid: string) =>
  fetchPost(endpoints.ASSET_HISTORY_EXPORT.replace(':asset_uid', assetUid), {notifyAboutError: false})
    .catch((error) => {
      const failResponse: FailResponse = {
        status: 500,
        statusText: error.message || t('An error occurred while exporting the logs'),
      };
      throw failResponse;
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
export const useActivityLogsFilterOptionsQuery = (assetUid: string) =>
  useQuery({
    queryKey: [QueryKeys.activityLogsFilter, assetUid],
    queryFn: () => getFilterOptions(assetUid),
  });

/**
 * This is a hook to start the exporting process of the activity logs.
 * @returns {() => void} The function to start the export
 */
export const useExportActivityLogs = () => startActivityLogsExport;
