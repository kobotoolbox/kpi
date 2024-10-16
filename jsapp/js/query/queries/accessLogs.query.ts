import {keepPreviousData, useQuery} from '@tanstack/react-query';
import {endpoints} from 'js/api.endpoints';
import type {PaginatedResponse} from 'js/dataInterface';
import {fetchGet} from 'js/api';

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

export default function useAccessLogsQuery(
  itemLimit: number,
  pageOffset: number
) {
  return useQuery({
    queryKey: ['accessLogs', itemLimit, pageOffset],
    queryFn: () => getAccessLogs(itemLimit, pageOffset),
    placeholderData: keepPreviousData,
    // We might want to improve this in future, for now let's not retry
    retry: false,
    // The `refetchOnWindowFocus` option is `true` by default, I'm setting it
    // here so we don't forget about it.
    refetchOnWindowFocus: true,
  });
}
