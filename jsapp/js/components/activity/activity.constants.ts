/**
 * All possible log item actions.
 * @see `AuditAction` class from {@link kobo/apps/audit_log/models.py} (BE code)
 */
export enum AuditActions {
  'update-name' = 'update-name',
  'update-settings' = 'update-settings',
  'deploy' = 'deploy',
  'redeploy' = 'redeploy',
  'archive' = 'archive',
  'unarchive' = 'unarchive',
  'replace-form' = 'replace-form',
  'update-form' = 'update-form',
  'export' = 'export',
  'update-qa' = 'update-qa',
  'add-media' = 'add-media',
  'delete-media' = 'delete-media',
  'connect-project' = 'connect-project',
  'disconnect-project' = 'disconnect-project',
  'modify-imported-fields' = 'modify-imported-fields',
  'modify-sharing' = 'modify-sharing',
  'enable-sharing' = 'enable-sharing',
  'disable-sharing' = 'disable-sharing',
  'register-service' = 'register-service',
  'modify-service' = 'modify-service',
  'delete-service' = 'delete-service',
  'add-user' = 'add-user',
  'remove-user' = 'remove-user',
  'update-permission' = 'update-permission',
  'make-public' = 'make-public',
  'share-public' = 'share-public',
  'transfer' = 'transfer',
}

type AuditActionTypes = {
  [P in AuditActions]: {
    name: AuditActions;
    message: string;
  };
};

export const AUDIT_ACTION_TYPES: AuditActionTypes = {
  'update-name': {
    name: AuditActions['update-name'],
    message: t('##username## changed project name'),
  },
  'update-settings': {
    name: AuditActions['update-settings'],
    message: t('##username## updated project settings'),
  },
  'deploy': {
    name: AuditActions['deploy'],
    message: t('##username## deployed project'),
  },
  'redeploy': {
    name: AuditActions['redeploy'],
    message: t('##username## redeployed project'),
  },
  'archive': {
    name: AuditActions['archive'],
    message: t('##username## archived project'),
  },
  'unarchive': {
    name: AuditActions['unarchive'],
    message: t('##username## unarchived project'),
  },
  'replace-form': {
    name: AuditActions['replace-form'],
    message: t('##username## uploaded a new form'),
  },
  'update-form': {
    name: AuditActions['update-form'],
    message: t('##username## edited the form in the formbuilder'),
  },
  'export': {
    name: AuditActions['export'],
    message: t('##username## exported data'),
  },
  'update-qa': {
    name: AuditActions['update-qa'],
    message: t('##username## modified qualitative analysis questions'),
  },
  'add-media': {
    name: AuditActions['add-media'],
    message: t('##username## added a media attachment'),
  },
  'delete-media': {
    name: AuditActions['delete-media'],
    message: t('##username## removed a media attachment'),
  },
  'connect-project': {
    name: AuditActions['connect-project'],
    message: t('##username## connected project data with another project'),
  },
  'disconnect-project': {
    name: AuditActions['disconnect-project'],
    message: t('##username## disconnected project from another project'),
  },
  'modify-imported-fields': {
    name: AuditActions['modify-imported-fields'],
    message: t('##username## changed imported fields from another project'),
  },
  'modify-sharing': {
    name: AuditActions['modify-sharing'],
    message: t('##username## modified data sharing'),
  },
  'enable-sharing': {
    name: AuditActions['enable-sharing'],
    message: t('##username## enabled data sharing'),
  },
  'disable-sharing': {
    name: AuditActions['disable-sharing'],
    message: t('##username## disabled data sharing'),
  },
  'register-service': {
    name: AuditActions['register-service'],
    message: t('##username## registered a new REST service'),
  },
  'modify-service': {
    name: AuditActions['modify-service'],
    message: t('##username## modified a REST service'),
  },
  'delete-service': {
    name: AuditActions['delete-service'],
    message: t('##username## deleted a REST service'),
  },
  'add-user': {
    name: AuditActions['add-user'],
    message: t('##username## added ##username2## to project'),
  },
  'remove-user': {
    name: AuditActions['remove-user'],
    message: t('##username## removed ##username2## from project'),
  },
  'update-permission': {
    name: AuditActions['update-permission'],
    message: t('##username## updated permissions of ##username2##'),
  },
  'make-public': {
    name: AuditActions['make-public'],
    message: t('##username## made the project publicly accessible'),
  },
  'share-public': {
    name: AuditActions['share-public'],
    message: t('##username## shared data publicly'),
  },
  'transfer': {
    name: AuditActions['transfer'],
    message: t('##username## transferred project ownership to ##username2##'),
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
    second_user?: string;
    // a lot of more optional metadata props…
  };
}
