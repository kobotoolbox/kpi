import type { PartialPermission } from '#/dataInterface'
import type { PermissionCodename } from '../permissions/permConstants'

/**
 * All possible log item actions.
 * @see `AuditAction` class from {@link kobo/apps/audit_log/models.py} (BE code)
 */
export enum AuditActions {
  'add-media' = 'add-media',
  'add-submission' = 'add-submission',
  'allow-anonymous-submissions' = 'allow-anonymous-submissions',
  archive = 'archive',
  'clone-permissions' = 'clone-permissions',
  'connect-project' = 'connect-project',
  'delete-media' = 'delete-media',
  'delete-service' = 'delete-service',
  'delete-submission' = 'delete-submission',
  deploy = 'deploy',
  'disable-sharing' = 'disable-sharing',
  'disallow-anonymous-submissions' = 'disallow-anonymous-submissions',
  'disconnect-project' = 'disconnect-project',
  'enable-sharing' = 'enable-sharing',
  export = 'export',
  'modify-imported-fields' = 'modify-imported-fields',
  'modify-service' = 'modify-service',
  'modify-sharing' = 'modify-sharing',
  'modify-submission' = 'modify-submission',
  'modify-qa-data' = 'modify-qa-data',
  'modify-user-permissions' = 'modify-user-permissions',
  redeploy = 'redeploy',
  'register-service' = 'register-service',
  'replace-form' = 'replace-form',
  'share-data-publicly' = 'share-data-publicly',
  'share-form-publicly' = 'share-form-publicly',
  transfer = 'transfer',
  unarchive = 'unarchive',
  'unshare-data-publicly' = 'unshare-data-publicly',
  'unshare-form-publicly' = 'unshare-form-publicly',
  'update-content' = 'update-content',
  'update-name' = 'update-name',
  'update-settings' = 'update-settings',
  'update-qa' = 'update-qa',
}

interface AuditActionDefinition {
  name: AuditActions
  label: string
  message: string
  /** This is the order at which the filtering dropdown should display the actions options. */
  order: number
}

/**
 * An ordered (the order matters!) list of audit action types.
 */
// biome-ignore format: the array should not be formatted, as it makes it harder to read
const _AUDIT_ACTION_TYPES: Array<Omit<AuditActionDefinition, 'order'>> = [
  {
    name: AuditActions['update-name'],
    label: t('change name'),
    message: t('##username## changed project name'),
  },
  {
    name: AuditActions['update-settings'],
    label: t('update settings'),
    message: t('##username## updated project settings'),
  },
  {
    name: AuditActions['deploy'],
    label: t('deploy project'),
    message: t('##username## deployed project'),
  },
  {
    name: AuditActions['redeploy'],
    label: t('redeploy project'),
    message: t('##username## redeployed project'),
  },
  {
    name: AuditActions['archive'],
    label: t('archive project'),
    message: t('##username## archived project'),
  },
  {
    name: AuditActions['unarchive'],
    label: t('unarchive project'),
    message: t('##username## unarchived project'),
  },
  {
    name: AuditActions['replace-form'],
    label: t('upload new form'),
    message: t('##username## uploaded a new form'),
  },
  {
    name: AuditActions['update-content'],
    label: t('edit form'),
    message: t('##username## edited the form in the form builder'),
  },
  {
    name: AuditActions['update-qa'],
    label: t('modify qualitative analysis questions'),
    message: t('##username## modified qualitative analysis questions'),
  },
  {
    name: AuditActions['modify-qa-data'],
    label: t('edit qualitative analysis data'),
    message: t('##username## edited qualitative analysis data'),
  },
  {
    name: AuditActions['export'],
    label: t('export data'),
    message: t('##username## exported data'),
  },
  {
    name: AuditActions['add-media'],
    label: t('add media attachment'),
    message: t('##username## added a media attachment'),
  },
  {
    name: AuditActions['delete-media'],
    label: t('remove media attachment'),
    message: t('##username## removed a media attachment'),
  },
  {
    name: AuditActions['modify-user-permissions'],
    label: t('update permissions'),
    message: t('##username## updated permissions of ##username2##'),
  },
  {
    name: AuditActions['clone-permissions'],
    label: t('clone permissions'),
    message: t('##username## cloned permissions from another project'),
  },
  {
    name: AuditActions['share-form-publicly'],
    label: t('make project public'),
    message: t('##username## made the project publicly accessible'),
  },
  {
    name: AuditActions['share-data-publicly'],
    label: t('share data publicly'),
    message: t('##username## shared data publicly'),
  },
  {
    name: AuditActions['allow-anonymous-submissions'],
    label: t('enable anonymous submissions'),
    message: t('##username## enabled anonymous submissions'),
  },
  {
    name: AuditActions['unshare-form-publicly'],
    label: t('disable making project public'),
    message: t('##username## disabled making project publicly accessible'),
  },
  {
    name: AuditActions['unshare-data-publicly'],
    label: t('disable sharing data publicly'),
    message: t('##username## disabled sharing data publicly'),
  },
  {
    name: AuditActions['disallow-anonymous-submissions'],
    label: t('disable anonymous submissions'),
    message: t('##username## disallowed anonymous submissions'),
  },
  {
    name: AuditActions['transfer'],
    label: t('transfer project ownership'),
    message: t('##username## transferred project ownership to ##username2##'),
  },
  {
    name: AuditActions['enable-sharing'],
    label: t('enable data sharing'),
    message: t('##username## enabled data sharing'),
  },
  {
    name: AuditActions['modify-sharing'],
    label: t('modify data sharing'),
    message: t('##username## modified data sharing'),
  },
  {
    name: AuditActions['disable-sharing'],
    label: t('disable data sharing'),
    message: t('##username## disabled data sharing'),
  },
  {
    name: AuditActions['connect-project'],
    label: t('connect project data'),
    message: t('##username## connected project data with another project'),
  },
  {
    name: AuditActions['modify-imported-fields'],
    label: t('change imported fields'),
    message: t('##username## changed imported fields from another project'),
  },
  {
    name: AuditActions['disconnect-project'],
    label: t('disconnect project'),
    message: t('##username## disconnected project from another project'),
  },
  {
    name: AuditActions['register-service'],
    label: t('register a new REST service'),
    message: t('##username## registered a new REST service'),
  },
  {
    name: AuditActions['modify-service'],
    label: t('modify a REST service'),
    message: t('##username## modified a REST service'),
  },
  {
    name: AuditActions['delete-service'],
    label: t('delete a REST service'),
    message: t('##username## deleted a REST service'),
  },
  {
    name: AuditActions['add-submission'],
    label: t('add submission'),
    message: t('##username## added a submission'),
  },
  {
    name: AuditActions['modify-submission'],
    label: t('edit submission'),
    message: t('##username## edited a submission'),
  },
  {
    name: AuditActions['delete-submission'],
    label: t('delete a submission'),
    message: t('##username## deleted a submission'),
  },
]

type AuditActionTypes = {
  [P in AuditActions]: AuditActionDefinition
}

export const AUDIT_ACTION_TYPES: AuditActionTypes = _AUDIT_ACTION_TYPES.reduce((acc, action, index) => {
  acc[action.name] = { ...action, order: index } as AuditActionDefinition
  return acc
}, {} as AuditActionTypes)

export const FALLBACK_MESSAGE = '##username## did action ##action##'

export const HIDDEN_AUDIT_ACTIONS = [AuditActions['add-submission']]

export enum AuditSubTypes {
  project = 'project',
  permission = 'permission',
}

export interface ActivityLogsItem {
  /** User url. E.g. "https://kf.beta.kbtdev.org/api/v2/users/<username>/" */
  user: string
  user_uid: string
  username: string
  /** Date string in ISO 8601. E.g. "2024-10-04T14:04:18Z" */
  date_created: string
  action: AuditActions
  metadata: {
    /** E.g. "Firefox (Ubuntu)" */
    source: string
    asset_uid: string
    /** E.g. "71.235.120.86" */
    ip_address: string
    log_subtype: AuditSubTypes
    // All props below are optional and depends on the action
    old_name?: string
    new_name?: string
    version_uid?: string
    latest_version_uid?: string
    latest_deployed_version_uid?: string
    username?: string
    permissions?: {
      username: string
      added?: Array<PermissionCodename | AuditPartialPermission>
      removed?: Array<PermissionCodename | AuditPartialPermission>
    }
    submission?: {
      root_uuid: string
      submitted_by: string
    }
    /** Username */
    project_owner?: string
    'asset-file'?: {
      uid: string
      filename: string
      md5_hash: string
      download_url: string
    }
  }
}

/**
 * This is a partial permission object that is used in history endpoint. It uses `code` instead of `url`, which might be
 * a mistake.
 */
export interface AuditPartialPermission extends Omit<PartialPermission, 'url'> {
  code: PermissionCodename
}

export interface AssetHistoryActionsResponse {
  actions: Array<keyof typeof AuditActions>
}
