/**
 * All possible log item actions.
 * @see `AuditAction` class from {@link kobo/apps/audit_log/models.py} (BE code)
 */
export enum AuditActions {
  'add-media' = 'add-media',
  'add-submission' = 'add-submission',
  'allow-anonymous-submissions' = 'allow-anonymous-submissions',
  'archive' = 'archive',
  'clone-permissions' = 'clone-permissions',
  'connect-project' = 'connect-project',
  'delete-media' = 'delete-media',
  'delete-service' = 'delete-service',
  'delete-submission' = 'delete-submission',
  'deploy' = 'deploy',
  'disable-sharing' = 'disable-sharing',
  'disallow-anonymous-submissions' = 'disallow-anonymous-submissions',
  'disconnect-project' = 'disconnect-project',
  'enable-sharing' = 'enable-sharing',
  'export' = 'export',
  'modify-imported-fields' = 'modify-imported-fields',
  'modify-service' = 'modify-service',
  'modify-sharing' = 'modify-sharing',
  'modify-submission' = 'modify-submission',
  'modify-user-permissions' = 'modify-user-permissions',
  'redeploy' = 'redeploy',
  'register-service' = 'register-service',
  'replace-form' = 'replace-form',
  'share-data-publicly' = 'share-data-publicly',
  'share-form-publicly' = 'share-form-publicly',
  'transfer' = 'transfer',
  'unarchive' = 'unarchive',
  'unshare-data-publicly' = 'unshare-data-publicly',
  'unshare-form-publicly' = 'unshare-form-publicly',
  'update-content' = 'update-content',
  'update-name' = 'update-name',
  'update-settings' = 'update-settings',
  'update-qa' = 'update-qa',
}

type AuditActionTypes = {
  [P in AuditActions]: {
    name: AuditActions;
    label: string;
    message: string;
    order: number;
  };
};

export const AUDIT_ACTION_TYPES: AuditActionTypes = {
  'add-media': {
    order: 10,
    name: AuditActions['add-media'],
    label: t('add media attachment'),
    message: t('##username## added a media attachment'),
  },
  'add-submission': {
    order: 30,
    name: AuditActions['add-submission'],
    label: t('add submission'),
    message: t('##username## added a submission'),
  },
  'allow-anonymous-submissions': {
    order: 16,
    name: AuditActions['allow-anonymous-submissions'],
    label: t('enable anonymous submissions'),
    message: t('##username## enabled anonymous submissions'),
  },
  'archive': {
    order: 4,
    name: AuditActions['archive'],
    label: t('archive project'),
    message: t('##username## archived project'),
  },
  'clone-permissions': {
    order: 13,
    name: AuditActions['clone-permissions'],
    label: t('clone permissions'),
    message: t('##username## cloned permissions from another project'),
  },
  'connect-project': {
    order: 24,
    name: AuditActions['connect-project'],
    label: t('connect project data'),
    message: t('##username## connected project data with another project'),
  },
  'delete-media': {
    order: 11,
    name: AuditActions['delete-media'],
    label: t('remove media attachment'),
    message: t('##username## removed a media attachment'),
  },
  'delete-service': {
    order: 29,
    name: AuditActions['delete-service'],
    label: t('delete a REST service'),
    message: t('##username## deleted a REST service'),
  },
  'delete-submission': {
    order: 32,
    name: AuditActions['delete-submission'],
    label: t('delete a submission'),
    message: t('##username## deleted a submission'),
  },
  'deploy': {
    order: 2,
    name: AuditActions['deploy'],
    label: t('deploy project'),
    message: t('##username## deployed project'),
  },
  'disable-sharing': {
    order: 23,
    name: AuditActions['disable-sharing'],
    label: t('disable data sharing'),
    message: t('##username## disabled data sharing'),
  },
  'disallow-anonymous-submissions': {
    order: 19,
    name: AuditActions['disallow-anonymous-submissions'],
    label: t('disable anonymous submissions'),
    message: t('##username## disallowed anonymous submissions'),
  },
  'disconnect-project': {
    order: 26,
    name: AuditActions['disconnect-project'],
    label: t('disconnect project'),
    message: t('##username## disconnected project from another project'),
  },
  'enable-sharing': {
    order: 21,
    name: AuditActions['enable-sharing'],
    label: t('enable data sharing'),
    message: t('##username## enabled data sharing'),
  },
  'export': {
    order: 9,
    name: AuditActions['export'],
    label: t('export data'),
    message: t('##username## exported data'),
  },
  'modify-imported-fields': {
    order: 25,
    name: AuditActions['modify-imported-fields'],
    label: t('change imported fields'),
    message: t('##username## changed imported fields from another project'),
  },
  'modify-service': {
    order: 28,
    name: AuditActions['modify-service'],
    label: t('modify a REST service'),
    message: t('##username## modified a REST service'),
  },
  'modify-sharing': {
    order: 22,
    name: AuditActions['modify-sharing'],
    label: t('modify data sharing'),
    message: t('##username## modified data sharing'),
  },
  'modify-submission': {
    order: 31,
    name: AuditActions['modify-submission'],
    label: t('edit submission'),
    message: t('##username## edited a submission'),
  },
  'modify-user-permissions': {
    order: 12,
    name: AuditActions['modify-user-permissions'],
    label: t('update permissions'),
    message: t('##username## updated permissions of ##username2##'),
  },
  'redeploy': {
    order: 3,
    name: AuditActions['redeploy'],
    label: t('redeploy project'),
    message: t('##username## redeployed project'),
  },
  'register-service': {
    order: 27,
    name: AuditActions['register-service'],
    label: t('register a new REST service'),
    message: t('##username## registered a new REST service'),
  },
  'replace-form': {
    order: 6,
    name: AuditActions['replace-form'],
    label: t('upload new form'),
    message: t('##username## uploaded a new form'),
  },
  'share-data-publicly': {
    order: 15,
    name: AuditActions['share-data-publicly'],
    label: t('share data publicly'),
    message: t('##username## shared data publicly'),
  },
  'share-form-publicly': {
    order: 14,
    name: AuditActions['share-form-publicly'],
    label: t('make project public'),
    message: t('##username## made the project publicly accessible'),
  },
  'transfer': {
    order: 20,
    name: AuditActions['transfer'],
    label: t('transfer project ownership'),
    message: t('##username## transferred project ownership to ##username2##'),
  },
  'unarchive': {
    order: 5,
    name: AuditActions['unarchive'],
    label: t('unarchive project'),
    message: t('##username## unarchived project'),
  },
  'unshare-data-publicly': {
    order: 18,
    name: AuditActions['unshare-data-publicly'],
    label: t('disable sharing data publicly'),
    message: t('##username## disabled sharing data publicly'),
  },
  'unshare-form-publicly': {
    order: 17,
    name: AuditActions['unshare-form-publicly'],
    label: t('disable making project public'),
    message: t('##username## disabled making project publicly accessible'),
  },
  'update-content': {
    order: 7,
    name: AuditActions['update-content'],
    label: t('edit form'),
    message: t('##username## edited the form in the form builder'),
  },
  'update-name': {
    order: 0,
    name: AuditActions['update-name'],
    label: t('change name'),
    message: t('##username## changed project name'),
  },
  'update-settings': {
    order: 1,
    name: AuditActions['update-settings'],
    label: t('update settings'),
    message: t('##username## updated project settings'),
  },
  'update-qa': {
    order: 8,
    name: AuditActions['update-qa'],
    label: t('modify qualitative analysis questions'),
    message: t('##username## modified qualitative analysis questions'),
  },
};

export const FALLBACK_MESSAGE = '##username## did action ##action##';

export const HIDDEN_AUDIT_ACTIONS = [AuditActions['add-submission']];

/**
 * All possible log item types.
 * @see `AuditType` class from {@link kobo/apps/audit_log/models.py} (BE code)
 */
export enum AuditTypes {
  access = 'access',
  'project-history' = 'project-history',
  'data-editing' = 'data-editing',
  'user-management' = 'user-management',
  'asset-management' = 'asset-management',
  'submission-management' = 'submission-management',
}

export enum AuditSubTypes {
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
    latest_deployed_version_id?: string;
    latest_version_id?: string;
    version_uid?: string;
    username?: string;
    permissions?: {
      username: string;
    };
  };
}
