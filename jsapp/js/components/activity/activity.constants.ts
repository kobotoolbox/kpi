/**
 * All possible log item actions.
 * @see `AuditAction` class from {@link kobo/apps/audit_log/models.py} (BE code)
 */
export enum AuditActions {
  'add-media' = 'add-media',
  'allow-anonymous-submissions' = 'allow-anonymous-submissions',
  'archive' = 'archive',
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

  // The keys below are not present in the BE code
  // and may need to be removed or updated.
  // See: /kpi/kobo/apps/audit_log/views.py
  'update-form' = 'update-form',
  'add-user' = 'add-user',
  'remove-user' = 'remove-user',
  'update-permission' = 'update-permission',
  'make-public' = 'make-public',
  'share-public' = 'share-public',
}

type AuditActionTypes = {
  [P in AuditActions]: {
    name: AuditActions;
    message: string;
  };
};

export const AUDIT_ACTION_TYPES: AuditActionTypes = {
  'add-media': {
    name: AuditActions['add-media'],
    message: t('##username## added a media attachment'),
  },
  'allow-anonymous-submissions': {
    name: AuditActions['allow-anonymous-submissions'],
    message: t('##username## allowed anonymous submissions'),
  },
  'archive': {
    name: AuditActions['archive'],
    message: t('##username## archived project'),
  },
  'connect-project': {
    name: AuditActions['connect-project'],
    message: t('##username## connected project data with another project'),
  },
  'delete-media': {
    name: AuditActions['delete-media'],
    message: t('##username## removed a media attachment'),
  },
  'delete-service': {
    name: AuditActions['delete-service'],
    message: t('##username## deleted a REST service'),
  },
  'deploy': {
    name: AuditActions['deploy'],
    message: t('##username## deployed project'),
  },
  'disable-sharing': {
    name: AuditActions['disable-sharing'],
    message: t('##username## disabled data sharing'),
  },
  'disallow-anonymous-submissions': {
    name: AuditActions['disallow-anonymous-submissions'],
    message: t('##username## disallowed anonymous submissions'),
  },
  'disconnect-project': {
    name: AuditActions['disconnect-project'],
    message: t('##username## disconnected project from another project'),
  },
  'enable-sharing': {
    name: AuditActions['enable-sharing'],
    message: t('##username## enabled data sharing'),
  },
  'export': {
    name: AuditActions['export'],
    message: t('##username## exported data'),
  },
  'modify-imported-fields': {
    name: AuditActions['modify-imported-fields'],
    message: t('##username## changed imported fields from another project'),
  },
  'modify-service': {
    name: AuditActions['modify-service'],
    message: t('##username## modified a REST service'),
  },
  'modify-sharing': {
    name: AuditActions['modify-sharing'],
    message: t('##username## modified data sharing'),
  },
  'modify-user-permissions': {
    name: AuditActions['modify-user-permissions'],
    message: t('##username## modified user permissions'),
  },
  'redeploy': {
    name: AuditActions['redeploy'],
    message: t('##username## redeployed project'),
  },
  'register-service': {
    name: AuditActions['register-service'],
    message: t('##username## registered a new REST service'),
  },
  'replace-form': {
    name: AuditActions['replace-form'],
    message: t('##username## uploaded a new form'),
  },
  'share-data-publicly': {
    name: AuditActions['share-data-publicly'],
    message: t('##username## shared data publicly'),
  },
  'share-form-publicly': {
    name: AuditActions['share-form-publicly'],
    message: t('##username## shared form publicly'),
  },
  'transfer': {
    name: AuditActions['transfer'],
    message: t('##username## transferred project ownership to ##username2##'),
  },
  'unarchive': {
    name: AuditActions['unarchive'],
    message: t('##username## unarchived project'),
  },
  'unshare-data-publicly': {
    name: AuditActions['unshare-data-publicly'],
    message: t('##username## unshared data publicly'),
  },
  'unshare-form-publicly': {
    name: AuditActions['unshare-form-publicly'],
    message: t('##username## unshared form publicly'),
  },
  'update-content': {
    name: AuditActions['update-content'],
    message: t('##username## updated content'),
  },
  'update-name': {
    name: AuditActions['update-name'],
    message: t('##username## changed project name'),
  },
  'update-settings': {
    name: AuditActions['update-settings'],
    message: t('##username## updated project settings'),
  },
  'update-qa': {
    name: AuditActions['update-qa'],
    message: t('##username## modified qualitative analysis questions'),
  },

  // The keys below are not present in the BE code
  // and may need to be removed or updated.
  // See: /kpi/kobo/apps/audit_log/views.py
  'update-form': {
    name: AuditActions['update-form'],
    message: t('##username## edited the form in the formbuilder'),
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
