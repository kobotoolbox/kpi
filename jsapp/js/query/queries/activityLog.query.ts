import {keepPreviousData, useQuery} from '@tanstack/react-query';
import type {KoboSelectOption} from 'jsapp/js/components/common/koboSelect';
import type {PaginatedResponse} from 'jsapp/js/dataInterface';
import moment from 'moment';
import {QueryKeys} from '../queryKeys';

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
 * @param limit Pagination parameter: number of items per page
 * @param offset Pagination parameter: offset of the page
 * @returns
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
 * @returns
 */
const getFilterOptions = async () =>
  new Promise<KoboSelectOption[]>((resolve) => {
    setTimeout(() => resolve(mockOptions), 1000);
  });

/**
 *
 *  This is a hook that fetches activity logs from the server.
 *
 * @param itemLimit Pagination parameter: number of items per page
 * @param pageOffset Pagination parameter: offset of the page
 * @returns
 */
export const useActivityLogsQuery = (itemLimit: number, pageOffset: number) =>
  useQuery({
    queryKey: [QueryKeys.activityLog, itemLimit, pageOffset],
    queryFn: () => getActivityLogs(itemLimit, pageOffset),
    placeholderData: keepPreviousData,
  });

/**
 * This is a hook to fetch the filter options for the activity logs.
 * @returns
 */
export const useActivityLogsFilterOptionsQuery = () =>
  useQuery({
    queryKey: [QueryKeys.activityLogsFilter],
    queryFn: () => getFilterOptions(),
  });
