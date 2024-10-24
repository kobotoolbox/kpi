import {keepPreviousData, useQuery} from '@tanstack/react-query';
import type {KoboSelectOption} from 'js/components/common/koboSelect';
import type {PaginatedResponse} from 'js/dataInterface';
import moment from 'moment';
import {QueryKeys} from 'js/query/queryKeys';

export interface ActivityLogsItem {
  id: number;
  who: string;
  action: string;
  what: string;
  date: string;
}

// MOCK DATA GENERATION
const mockOptions: KoboSelectOption[] = [
  {value: '1', label: 'Option 1'},
  {value: '2', label: 'Option 2'},
  {value: '3', label: 'Option 3'},
];

const getRandomMockDescriptionData = () => {
  const who = ['Trent', 'Jane', 'Alice', 'Bob', 'Charlie'];
  const action = ['created', 'updated', 'deleted', 'added', 'removed'];
  const what = ['project property', 'the form', 'the permissions'];
  return {
    who: who[Math.floor(Math.random() * who.length)],
    action: action[Math.floor(Math.random() * action.length)],
    what: what[Math.floor(Math.random() * what.length)],
  };
};

const curDate = new Date();
const mockData: ActivityLogsItem[] = Array.from({length: 150}, (_, index) => {
  curDate.setTime(curDate.getTime() - Math.random() * 1000000);
  return {
    id: index,
    ...getRandomMockDescriptionData(),
    date: moment(curDate).format('YYYY-MM-DD HH:mm:ss'),
  };
});
// END OF MOCK GENERATION

/**
 * Fetches the activity logs from the server.
 * @param {number} limit Pagination parameter: number of items per page
 * @param {number} offset Pagination parameter: offset of the page
 * @returns {Promise<PaginatedResponse<ActivityLogsItem>>} The paginated response
 */
const getActivityLogs = async (limit: number, offset: number) =>
  new Promise<PaginatedResponse<ActivityLogsItem>>((resolve) => {
    setTimeout(
      () =>
        resolve({
          next: null,
          previous: null,
          count: mockData.length,
          results: mockData.slice(offset, offset + limit),
        } as PaginatedResponse<ActivityLogsItem>),
      1000
    );
  });

/**
 * Fetches the filter options for the activity logs.
 * @returns {Promise<KoboSelectOption[]>} The filter options
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
        reject();
      }
    }, 500);
  });

/**
 *
 *  This is a hook that fetches activity logs from the server.
 *
 * @param {number} itemLimit Pagination parameter: number of items per page
 * @param {number} pageOffset Pagination parameter: offset of the page
 * @returns {UseQueryResult<PaginatedResponse<ActivityLogsItem>>} The react query result
 */
export const useActivityLogsQuery = (itemLimit: number, pageOffset: number) =>
  useQuery({
    queryKey: [QueryKeys.activityLogs, itemLimit, pageOffset],
    queryFn: () => getActivityLogs(itemLimit, pageOffset),
    placeholderData: keepPreviousData,
  });

/**
 * This is a hook to fetch the filter options for the activity logs.
 * @returns {UseQueryResult<KoboSelectOption[]>} The react query result
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
