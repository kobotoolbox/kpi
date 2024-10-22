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

export interface ExportStatus {
  status: 'in_progress' | 'done' | 'not_started';
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

const exportData: {
  startTime?: number;
  endTime?: number;
  data?: ActivityLogsItem[];
} = {
  startTime: undefined,
  endTime: undefined,
  data: undefined,
};
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
const startActivityLogsExport = async () => {
  // Simulates backend export process.
  // Here we just start it and get a feedback if it's done.
  exportData.startTime = Date.now();
  exportData.endTime = undefined;
  exportData.data = undefined;
  setTimeout(() => {
    exportData.endTime = Date.now();
    exportData.data = mockData;
  }, 10000);
};

/**
 * Fetches the export status of the activity logs.
 * @returns {Promise<ExportStatus>} The export status
 */
const getExportStatus = async (): Promise<ExportStatus> => {
  // Simulates backend export process.
  // Here we just start it and get a feedback if it's done.
  if (exportData.startTime && !exportData.endTime) {
    return {status: 'in_progress'};
  }

  if (exportData.startTime && exportData.endTime) {
    return {status: 'done'};
  }

  return {status: 'not_started'};
};

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
 * This is a hook to fetch the export status of the activity logs.
 * @returns {UseQueryResult<ExportStatus>} The react query result
 */
export const useExportStatusQuery = (isInProgress: boolean) =>
  useQuery({
    queryKey: [QueryKeys.activityLogsExportStatus],
    queryFn: getExportStatus,
    refetchInterval: 2500,
    enabled: isInProgress,
  });

/**
 * This is a hook to start the exporting process of the activity logs.
 * To follow up the export status, use the {@link useExportStatusQuery} hook.
 * @returns {() => void} The function to start the export
 */
export const useExportActivityLogs = () => startActivityLogsExport;
