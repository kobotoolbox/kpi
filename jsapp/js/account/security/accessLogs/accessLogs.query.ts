import {keepPreviousData, useQuery} from '@tanstack/react-query';
import {endpoints} from 'js/api.endpoints';
import type {FailResponse, PaginatedResponse} from 'js/dataInterface';
import {fetchGet, fetchPost} from 'js/api';
import {QueryKeys} from 'js/query/queryKeys';
import type {PaginatedQueryHookParams} from 'jsapp/js/universalTable/paginatedQueryUniversalTable.component';

export interface AccessLog {
  /** User URL */
  user: string;
  user_uid: string;
  /** Date string */
  date_created: string;
  username: string;
  metadata: {
    auth_type: 'digest' | 'submission-group' | string;
    // Both `source` and `ip_address` appear only for `digest` type
    /** E.g. "Firefox (Ubuntu)" */
    source?: string;
    ip_address?: string;
  };
  /** For `submission-group` type, here is the number of submisssions. */
  count: number;
}

async function getAccessLogs(limit: number, offset: number) {
  const params = new URLSearchParams({
    limit: limit.toString(),
    offset: offset.toString(),
  });
  return fetchGet<PaginatedResponse<AccessLog>>(
    endpoints.ACCESS_LOGS_URL + '?' + params,
    {
      errorMessageDisplay: t('There was an error getting the list.'),
    }
  );
}

export default function useAccessLogsQuery({limit, offset}: PaginatedQueryHookParams) {
  return useQuery({
    queryKey: [QueryKeys.accessLogs, limit, offset],
    queryFn: () => getAccessLogs(limit, offset),
    placeholderData: keepPreviousData,
    // We might want to improve this in future, for now let's not retry
    retry: false,
    // The `refetchOnWindowFocus` option is `true` by default, I'm setting it
    // here so we don't forget about it.
    refetchOnWindowFocus: true,
  });
}

/**
 * Starts the exporting process of the access logs.
 * @returns {Promise<void>} A promise that starts the export.
 */
export const startAccessLogsExport = () =>
  fetchPost(endpoints.ACCESS_LOGS_EXPORT_URL, {notifyAboutError: false})
    .catch((error) => {
      const failResponse: FailResponse = {
        status: 500,
        statusText:
          error.message || t('An error occurred while exporting the logs'),
      };
      throw failResponse;
    });
