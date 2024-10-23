import {keepPreviousData, useQuery} from '@tanstack/react-query';
import type {KoboSelectOption} from 'jsapp/js/components/common/koboSelect';
import type {PaginatedResponse} from 'jsapp/js/dataInterface';
import moment from 'moment';
import {QueryKeys} from '../queryKeys';

/**
 * All possible log item actions.
 * @see `AuditAction` class from {@link kobo/apps/audit_log/models.py} (BE code)
 */
enum AuditActions {
  create = 'create',
  delete = 'delete',
  'in-trash' = 'in-trash',
  'put-back' = 'put-back',
  remove = 'remove',
  update = 'update',
  auth = 'auth',
  deploy = 'deploy',
  archive = 'archive',
  unarchive = 'unarchive',
  redeploy = 'redeploy',
  'update-name' = 'update-name',
  'update-form' = 'update-form',
  'update-settings' = 'update-settings',
  'update-qa' = 'update-qa',
  'disable-sharing' = 'disable-sharing',
  'enable-sharing' = 'enable-sharing',
  'modify-sharing' = 'modify-sharing',
}

/**
 * All possible log item types.
 * @see `AuditType` class from {@link kobo/apps/audit_log/models.py} (BE code)
 */
enum AuditTypes {
  access = 'access',
  'project-history' = 'project-history',
  'data-editing' = 'data-editing',
  'user-management' = 'user-management',
  'asset-management' = 'asset-management',
  'submission-management' = 'submission-management',
}

enum AuditSubTypes {
  project = 'project',
  permission = 'permission',
}

export interface ActivityLogsItem {
  /** User url. E.g. "https://kf.beta.kbtdev.org/api/v2/users/<username>/" */
  user: string;
  user_uid: string;
  username: string;
  /** Date string in ISO 8601. E.g. "2024-10-04T14:04:18Z" */
  date_created: string;
  action: AuditActions;
  log_type: AuditTypes;
  metadata: {
    /** E.g. "Firefox (Ubuntu)" */
    source: string;
    asset_uid: string;
    /** E.g. "71.235.120.86" */
    ip_address: string;
    log_subtype: AuditSubTypes;
    old_name?: string;
    new_name?: string;
    version_uid?: string;
    permission_granted?: string;
    // a lot of more optional metadata props…
  };
}

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
  const old_name = 'I kwno somethign';
  const new_name = 'I know something';

  return {
    user,
    user_uid,
    username,
    action: action as AuditActions,
    log_type: log_type as AuditTypes,
    metadata: {
      source,
      asset_uid,
      ip_address,
      log_subtype: log_subtype as AuditSubTypes,
      old_name,
      new_name,
    },
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
 */
const getFilterOptions = async () =>
  new Promise<KoboSelectOption[]>((resolve) => {
    setTimeout(() => resolve(mockOptions), 1000);
  });

/**
 * This is a hook that fetches activity logs from the server.
 *
 * @param itemLimit Pagination parameter: number of items per page
 * @param pageOffset Pagination parameter: offset of the page
 */
export const useActivityLogsQuery = (itemLimit: number, pageOffset: number) =>
  useQuery({
    queryKey: [QueryKeys.activityLogs, itemLimit, pageOffset],
    queryFn: () => getActivityLogs(itemLimit, pageOffset),
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
