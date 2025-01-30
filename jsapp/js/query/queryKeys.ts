/**
 * These are query keys to be used in the `react-query` library.
 * They are used to identify the queries in the cache and may need to be used to
 * invalidate them, so it's important to keep their names as variables to avoid any
 * kind of typo.
 *
 * Keep keys sorted alphabetically.
 */
export enum QueryKeys {
  accessLogs = 'accessLogs',
  activityLogs = 'activityLogs',
  activityLogsFilter = 'activityLogsFilter',
  organization = 'organization',
  organizationMembers = 'organizationMembers',
  organizationMemberInviteDetail = 'organizationMemberInviteDetail',
}
