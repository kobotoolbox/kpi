/**
 * All possible log item actions.
 * @see `AuditAction` class from {@link kobo/apps/audit_log/models.py} (BE code)
 */
export enum AuditActions {
  'add-media' = 'add-media',
  'allow-anonymous-submissions' = 'allow-anonymous-submissions',
  'archive' = 'archive',
  'clone-permissions' = 'clone-permissions',
  'connect-project' = 'connect-project',
  'delete-media' = 'delete-media',
  'delete-service' = 'delete-service',
  'deploy' = 'deploy',
  'disable-sharing' = 'disable-sharing',
  'disallow-anonymous-submissions' = 'disallow-anonymous-submissions',
  'disconnect-project' = 'disconnect-project',
  'enable-sharing' = 'enable-sharing',
  'export' = 'export',
  'modify-imported-fields' = 'modify-imported-fields',
  'modify-service' = 'modify-service',
  'modify-sharing' = 'modify-sharing',
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
  };
};

export const AUDIT_ACTION_TYPES: AuditActionTypes = {
  'add-media': {
    name: AuditActions['add-media'],
    label: t('add media attachment'),
    message: t('##username## added a media attachment'),
  },
  'allow-anonymous-submissions': {
    name: AuditActions['allow-anonymous-submissions'],
    label: t('enable anonymous submissions'),
    message: t('##username## enabled anonymous submissions'),
  },
  'archive': {
    name: AuditActions['archive'],
    label: t('archive project'),
    message: t('##username## archived project'),
  },
  'clone-permissions': {
    name: AuditActions['clone-permissions'],
    label: t('clone permissions'),
    message: t('##username## cloned permissions from another project'),
  },
  'connect-project': {
    name: AuditActions['connect-project'],
    label: t('connect project data'),
    message: t('##username## connected project data with another project'),
  },
  'delete-media': {
    name: AuditActions['delete-media'],
    label: t('remove media attachment'),
    message: t('##username## removed a media attachment'),
  },
  'delete-service': {
    name: AuditActions['delete-service'],
    label: t('delete a REST service'),
    message: t('##username## deleted a REST service'),
  },
  'deploy': {
    name: AuditActions['deploy'],
    label: t('deploy project'),
    message: t('##username## deployed project'),
  },
  'disable-sharing': {
    name: AuditActions['disable-sharing'],
    label: t('disable data sharing'),
    message: t('##username## disabled data sharing'),
  },
  'disallow-anonymous-submissions': {
    name: AuditActions['disallow-anonymous-submissions'],
    label: t('disable anonymous submissions'),
    message: t('##username## disallowed anonymous submissions'),
  },
  'disconnect-project': {
    name: AuditActions['disconnect-project'],
    label: t('disconnect project'),
    message: t('##username## disconnected project from another project'),
  },
  'enable-sharing': {
    name: AuditActions['enable-sharing'],
    label: t('enable data sharing'),
    message: t('##username## enabled data sharing'),
  },
  'export': {
    name: AuditActions['export'],
    label: t('export data'),
    message: t('##username## exported data'),
  },
  'modify-imported-fields': {
    name: AuditActions['modify-imported-fields'],
    label: t('change imported fields'),
    message: t('##username## changed imported fields from another project'),
  },
  'modify-service': {
    name: AuditActions['modify-service'],
    label: t('modify a REST service'),
    message: t('##username## modified a REST service'),
  },
  'modify-sharing': {
    name: AuditActions['modify-sharing'],
    label: t('modify data sharing'),
    message: t('##username## modified data sharing'),
  },
  'modify-user-permissions': {
    name: AuditActions['modify-user-permissions'],
    label: t('update permissions'),
    message: t('##username## updated permissions of ##username2##'),
  },
  'redeploy': {
    name: AuditActions['redeploy'],
    label: t('redeploy project'),
    message: t('##username## redeployed project'),
  },
  'register-service': {
    name: AuditActions['register-service'],
    label: t('register a new REST service'),
    message: t('##username## registered a new REST service'),
  },
  'replace-form': {
    name: AuditActions['replace-form'],
    label: t('upload new form'),
    message: t('##username## uploaded a new form'),
  },
  'share-data-publicly': {
    name: AuditActions['share-data-publicly'],
    label: t('share data publicly'),
    message: t('##username## shared data publicly'),
  },
  'share-form-publicly': {
    name: AuditActions['share-form-publicly'],
    label: t('make project public'),
    message: t('##username## made the project publicly accessible'),
  },
  'transfer': {
    name: AuditActions['transfer'],
    label: t('transfer project ownership'),
    message: t('##username## transferred project ownership to ##username2##'),
  },
  'unarchive': {
    name: AuditActions['unarchive'],
    label: t('unarchive project'),
    message: t('##username## unarchived project'),
  },
  'unshare-data-publicly': {
    name: AuditActions['unshare-data-publicly'],
    label: t('disable sharing data publicly'),
    message: t('##username## disabled sharing data publicly'),
  },
  'unshare-form-publicly': {
    name: AuditActions['unshare-form-publicly'],
    label: t('disable making project public'),
    message: t('##username## disabled making project publicly accessible'),
  },
  'update-content': {
    name: AuditActions['update-content'],
    label: t('edit form'),
    message: t('##username## edited the form in the form builder'),
  },
  'update-name': {
    name: AuditActions['update-name'],
    label: t('change name'),
    message: t('##username## changed project name'),
  },
  'update-settings': {
    name: AuditActions['update-settings'],
    label: t('update settings'),
    message: t('##username## updated project settings'),
  },
  'update-qa': {
    name: AuditActions['update-qa'],
    label: t('modify qualitative analysis questions'),
    message: t('##username## modified qualitative analysis questions'),
  },
};

export const FALLBACK_MESSAGE = '##username## did action ##action##';

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
