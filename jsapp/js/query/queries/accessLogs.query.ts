import {useQuery} from '@tanstack/react-query';
import {endpoints} from 'js/api.endpoints';
import type {PaginatedResponse} from 'js/dataInterface';
import {fetchGet} from 'jsapp/js/api';
import data from './mockAccessLogs';

interface AccessLog {
  source_browser: string;
  source_os: string;
  ip_address: string;
  time: string;
  submissions: number | null;
}

// async function getAccessLogs(limit: number, offset: number) {
//   const params = new URLSearchParams({
//     limit: limit.toString(),
//     offset: offset.toString(),
//   });
//   return fetchGet<PaginatedResponse<AccessLog>>(
//     endpoints.ACCESS_LOGS_URL + '?' + params,
//     {
//       errorMessageDisplay: t('There was an error getting the list.'),
//     }
//   );
// }

// Currently using mocked data

function processData(limit: number, offset: number) {
  let slice = data.slice(offset)
  if (slice.length > limit) {
    slice.length = limit
  }
  let returnData = {
    count: data.length,
    next: "",
    previous: "",
    results: slice,
  }
  return returnData
}

async function getAccessLogs(limit: number, offset: number) {
  return new Promise<PaginatedResponse<AccessLog>>((resolve) => {
    setTimeout(() => resolve(processData(limit, offset)), 500);
  });
}

export default function useAccessLogsQuery(
  itemLimit: number,
  pageOffset: number
) {
  return useQuery({
    queryKey: ['accessLogs', itemLimit, pageOffset],
    queryFn: () => getAccessLogs(itemLimit, pageOffset),
  });
}
