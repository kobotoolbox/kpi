import {keepPreviousData, useQuery} from '@tanstack/react-query';
import type {KoboSelectOption} from 'js/components/common/koboSelect';
import type {FailResponse, PaginatedResponse} from 'js/dataInterface';
import moment from 'moment';
import {
  AuditActions,
  AuditTypes,
  AuditSubTypes,
  type ActivityLogsItem,
} from './activity.constants';
import {QueryKeys} from 'js/query/queryKeys';
import {fetchGet} from 'jsapp/js/api';
import {endpoints} from 'jsapp/js/api.endpoints';

// =============================================================================
// MOCK DATA GENERATION
const mockOptions: KoboSelectOption[] = [
  {value: '1', label: 'Option 1'},
  {value: '2', label: 'Option 2'},
  {value: '3', label: 'Option 3'},
];

const getRandomMockDescriptionData = () => {
  // user info
  const testUsernames = ['Trent', 'Jane', 'Alice', 'Bob', 'Charlie'];
  const username = testUsernames[Math.floor(Math.random() * testUsernames.length)];
  const user = `https://kf.beta.kbtdev.org/api/v2/users/${username.toLowerCase()}>/`;
  const user_uid = String(Math.random());

  // action
  const action = Object.keys(AuditActions)[Math.floor(Math.random() * Object.keys(AuditActions).length)];

  // log type
  const log_type = Object.keys(AuditTypes)[Math.floor(Math.random() * Object.keys(AuditTypes).length)];

  // metadata
  const log_subtype = Object.keys(AuditSubTypes)[Math.floor(Math.random() * Object.keys(AuditSubTypes).length)];
  const testSources = ['MacOS', 'iOS', 'Windows 98', 'CrunchBang Linux'];
  const source = testSources[Math.floor(Math.random() * testSources.length)];
  const asset_uid = String(Math.random());
  const ip_address = (Math.floor(Math.random() * 255) + 1) + '.' + (Math.floor(Math.random() * 255)) + '.' + (Math.floor(Math.random() * 255)) + '.' + (Math.floor(Math.random() * 255));

  const metadata: ActivityLogsItem['metadata'] = {
    source,
    asset_uid,
    ip_address,
    log_subtype: log_subtype as AuditSubTypes,
  };

  if (action === 'update-name') {
    metadata.old_name = 'I kwno somethign';
    metadata.new_name = 'I know something';
  }
  if (action === 'deploy' || action === 'redeploy') {
    metadata.latest_deployed_version_id = 'asd123f3fz';
  }
  if (action === 'replace-form' || action === 'update-form') {
    metadata.latest_version_id = 'aet4b1213c';
  }
  if (
    action === 'add-user' ||
    action === 'remove-user' ||
    action === 'update-permission' ||
    action === 'transfer'
  ) {
    metadata.second_user = 'Josh';
  }

  return {
    user,
    user_uid,
    username,
    action: action as AuditActions,
    log_type: log_type as AuditTypes,
    metadata: metadata,
  };
};

const curDate = new Date();
const mockData: ActivityLogsItem[] = Array.from({length: 150}, (_, index) => {
  curDate.setTime(curDate.getTime() - Math.random() * 1000000);
  return {
    id: index,
    ...getRandomMockDescriptionData(),
    date_created: moment(curDate).format('YYYY-MM-DD HH:mm:ss'),
  };
});
// END OF MOCK GENERATION
// =============================================================================

/**
 * Fetches the activity logs from the server.
 * @param limit Pagination parameter: number of items per page
 * @param offset Pagination parameter: offset of the page
 */
const getActivityLogs = async (projectId: string, limit: number, offset: number) => {

  fetchGet<PaginatedResponse<ActivityLogsItem>>(endpoints.ASSET_HISTORY.replace(':asset_id', projectId), {
    errorMessageDisplay: t('There was an error getting one-time add-ons.'),
  });

  return new Promise<PaginatedResponse<ActivityLogsItem>>((resolve) => {
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
export const useActivityLogsQuery = (itemLimit: number, pageOffset: number) => {
  const projectId = '123';
  return useQuery({
    queryKey: [QueryKeys.activityLogs, projectId, itemLimit, pageOffset],
    queryFn: () => getActivityLogs(projectId, itemLimit, pageOffset),
    placeholderData: keepPreviousData,
  });
};

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
