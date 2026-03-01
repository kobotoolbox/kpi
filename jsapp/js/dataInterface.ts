/**
 * The only file that is making calls to Backend. You shouldn't use it directly,
 * but through proper actions in `#/actions.js`.
 *
 * NOTE: In future all the calls from here will be moved to appropriate stores.
 */

import type { LanguageCode } from '#/components/languages/languagesStore'
import type { AssetLockingProfileDefinition } from '#/components/locking/lockingConstants'
import type { PermissionCodename } from '#/components/permissions/permConstants'
import type { ProjectTransferAssetDetail } from '#/components/permissions/transferProjects/transferProjects.api'
import type {
  AnalysisQuestionSchema,
  SubmissionAnalysisResponse,
} from '#/components/processing/SingleProcessingContent/TabAnalysis/common/constants'
import type {
  AssetResponseReportCustom,
  AssetResponseReportStyles,
  ReportsPaginatedResponse,
} from '#/components/reports/reportsConstants'
import type { SortValues } from '#/components/submissions/tableConstants'
import type { ValidationStatusName } from '#/components/submissions/validationStatus.constants'
import type { AnyRowTypeName, AssetFileType, AssetTypeName, FormStyleName } from '#/constants'
import type { UserResponse } from '#/users/userExistence.store'
import type { AccountFieldsValues } from './account/account.constants'
import { endpoints } from './api.endpoints'
import type { ResponseManualQualActionParams } from './api/models/responseManualQualActionParams'
import type { HookAuthLevelName, HookExportTypeName } from './components/RESTServices/RESTServicesForm'
import type { Json } from './components/common/common.interfaces'
import type {
  ExportFormatName,
  ExportMultiOptionName,
  ExportStatusName,
  ExportTypeName,
} from './components/projectDownloads/exportsConstants'
import { COMMON_QUERIES, ROOT_URL } from './constants'
import type { ProjectViewsSettings } from './projects/customViewStore'
import { type LangString, recordEntries } from './utils'

interface AssetsRequestData {
  q?: string
  limit?: number
  offset?: number
  parent?: string
  all_public?: boolean
  ordering?: string
  metadata?: string
  collections_first?: string
  status?: string
}

interface AssetsMetadataRequestData {
  q?: string
  limit?: number
  offset?: number
  parent?: string
  all_public?: boolean
  ordering?: string
  status?: string
}

export interface SearchAssetsPredefinedParams {
  uid?: string
  pageSize?: number
  page?: number
  searchPhrase?: string
  filterProperty?: string
  filterValue?: string
  ordering?: string
  metadata?: boolean
  collectionsFirst?: boolean
  status?: string
}

export interface BulkSubmissionsRequest {
  query?: {
    [id: string]: any
  }
  confirm?: boolean
  submission_ids?: string[]
  // Needed for updating validation status
  'validation_status.uid'?: ValidationStatusName
}

interface AssetFileRequest {
  description: string
  file_type: AssetFileType
  metadata: string
  base64Encoded: ArrayBuffer | string | null
}

export interface AssetFileResponse {
  uid: string
  url: string
  /** Asset URL */
  asset: string
  /** User URL */
  user: string
  user__username: string
  file_type: AssetFileType
  /** This used to be `name`, but we've changed it */
  description: string
  date_created: string
  /** URL to file content */
  content: string
  metadata: {
    /** MD5 hash */
    hash: string
    size: number
    type: string
    filename: string
    mimetype: string
  }
}
export interface CreateImportRequest {
  base64Encoded?: string | ArrayBuffer | null
  name?: string
  totalFiles?: number
  /** Url of the asset that should be replaced with XLSForm */
  destination?: string
  /** Uid of the asset that should be replaced with XLSForm */
  assetUid?: string
  /** Causes the imported XLSForm to be added as Library Item */
  library?: boolean
}

export interface ImportResponse {
  /** The uid of the import (not asset!) */
  uid: string
  url: string
  messages?: {
    updated?: Array<{
      uid: string
      kind: string
      summary: AssetSummary
      owner__username: string
    }>
    created?: Array<{
      uid: string
      kind: string
      summary: AssetSummary
      owner__username: string
    }>
    error?: string
    error_type?: string
  }
  status: 'complete' | 'created' | 'error' | 'processing'
}

export interface FailResponse {
  /**
   * This is coming from Back end and can have either the general `detail` or
   * `error`, or a list of specific errors (e.g. for specific fields).
   */
  responseJSON?: {
    detail?: string
    error?: string
    [fieldName: string]: string[] | string | undefined
  }
  responseText?: string
  status: number
  statusText: string
  headers?: Headers
}

/** Have a list of errors for different fields. */
export interface PasswordUpdateFailResponse {
  current_password: string[]
  new_password: string[]
}

interface ProcessingResponseData {
  [questionName: string]: any
  _id: number
}

export type GetProcessingSubmissionsResponse = PaginatedResponse<ProcessingResponseData>

/**
 * @deprecated use _DataResponseAttachments from Orval instead.
 */
export interface SubmissionAttachment {
  download_url: string
  download_large_url: string
  download_medium_url: string
  download_small_url: string
  mimetype: string
  filename: string
  media_file_basename: string
  question_xpath: string
  uid: string
  /** Marks the attachment as deleted. If `true`, all the `*_url` will return 404. */
  is_deleted?: boolean
}

interface TransxObject {
  languageCode: LanguageCode
  value: string
  dateCreated: string
  dateModified: string
  /** The source of the `value` text. */
  engine?: string
  /** The history of edits. */
  revisions?: Array<{
    dateModified: string
    engine?: string
    languageCode: LanguageCode
    value: string
  }>
}

export interface SubmissionSupplementalDetails {
  [questionName: string]: {
    transcript?: TransxObject
    translation?: {
      [languageCode: LanguageCode]: TransxObject
    }
    qual?: { [uuid: string]: SubmissionAnalysisResponse }
  }
}

/**
 * This is a completely empty object.
 *
 * We can't use `{}`, as it means "any non-nullish value". We are using `Record<string, never>` as the closes thing.
 */
export type SubmissionSupplementalDetailsEmpty = Record<string, never>

/**
 * Value of a property found in `SubmissionResponse`, it can be either a built
 * in submission property (e.g. `_geolocation`) or a response to a form question
 */
export type SubmissionResponseValue =
  | string
  | string[]
  | number
  | number[]
  // Sometimes being used as "no value" by backend
  | null
  // Being used as "no value" by backend for `_geolocation`
  | null[]
  // Sometimes being used as "no value" by backend
  | {}
  | SubmissionAttachment[]
  | SubmissionSupplementalDetails
  // These are responses to questions from repeat group
  | SubmissionResponseValueObject[]
  // This is needed because some of `SubmissionResponse` properties are optional
  | undefined

/**
 * A list of responses to form questions
 */
export interface SubmissionResponseValueObject {
  [questionName: string]: SubmissionResponseValue
}

/**
 * A list of responses to form questions plus some submission metadata
 *
 * @deprecated - use DataResponse from Orval instead.
 */
export interface SubmissionResponse extends SubmissionResponseValueObject {
  __version__: string
  _attachments: SubmissionAttachment[]
  // TODO: when does this happen to be array of nulls?
  _geolocation: number[] | null[]
  _notes: string[]
  _status: string
  _submission_time: string
  _submitted_by: string | null
  _tags: string[]
  // If submission was validated, this would be a proper response, otherwise it's empty object
  _validation_status: ValidationStatusResponse | {}
  _version_?: string
  _xform_id_string: string
  deviceid?: string
  end?: string
  // `meta/rootUuid` is persistent across edits while `_uuid` is not;
  // use the persistent identifier if present.
  _id: number
  _uuid: string
  'formhub/uuid': string
  'meta/instanceID': string
  /** Most probably you want to use it with `removeDefaultUuidPrefix` */
  'meta/rootUuid': string
  phonenumber?: string
  start?: string
  today?: string
  username?: string
  /**
   * For form with no advanced features enabled (i.e. NLP screen not visited)
   * it will be `undefined`. For forms with advanced features enabled, it will
   * be either empty object (i.e. given submission doesn't have any NLP features
   * applied to it) or a proper `SubmissionSupplementalDetails` object.
   */
  _supplementalDetails?: SubmissionSupplementalDetails | SubmissionSupplementalDetailsEmpty
}

interface AssignablePermissionRegular {
  url: string
  label: string
}

/**
 * A list of labels for partial permissions.
 *
 * WARNING: it only includes labels for `…PartialByUsers` type ("…only from
 * specific users"), so please use `CHECKBOX_LABELS` from `permConstants` file
 * instead.
 */
export interface AssignablePermissionPartialLabel {
  default: string
  view_submissions: string
  change_submissions: string
  delete_submissions: string
  validate_submissions: string
}

interface AssignablePermissionPartial {
  url: string
  label: AssignablePermissionPartialLabel
}

export type AssignablePermission = AssignablePermissionRegular | AssignablePermissionPartial

export interface LabelValuePair {
  /** Note: the labels are always localized in the current UI language */
  label: string
  value: string
}

export interface PartialPermissionFilterByUsers {
  _submitted_by?: string | { $in: string[] }
}

export type PartialPermissionFilterByResponses = Record<string, string>

/**
 * Filter can have properties of both of these interfaces, thus we use union
 * type here.
 */
export type PartialPermissionFilter = PartialPermissionFilterByUsers | PartialPermissionFilterByResponses

export interface PartialPermission {
  url: string
  /**
   * An array of filters (objects). Multiple objects means "OR", multiple
   * properties within the same filter mean "AND".
   *
   * There are much more possible cases here, but Front End is supporting only
   * a single filter object, i.e. the code will ignore `filters[1]`,
   * `filters[2]` etc. So the cases supported by current UI are:
   *
   * 1. single user:
   *    `filters: [{_submitted_by: 'joe'}]`
   * 2. single user alternative (equivalent to point above):
   *    `filters: [{_submitted_by: {$in: ['joe']}}]`
   * 3. multiple users:
   *    `filters: [{_submitted_by: {$in: ['bob', 'adam']}}]`
   * 4. single question response:
   *    `filters: [{question_one: 'answer'}]`
   * 5. user AND single question response:
   *    `filters: [{_submitted_by: 'joe', question_one: 'answer'}]`
   * 6. multiple users AND single question response:
   *    `filters: [{_submitted_by: {$in: ['bob', 'adam']}, question_one: 'answer'}]`
   */
  filters: PartialPermissionFilter[]
}

/** Permission object to be used when making API requests. */
export interface PermissionBase {
  /** User URL */
  user: string
  /** URL of given permission type. */
  permission: string
  partial_permissions?: PartialPermission[]
}

interface PartialPermissionLabel {
  default: string
  view_submissions: string
  change_submissions: string
  delete_submissions: string
  validate_submissions: string
}

/** A single permission instance for a given user coming from API endpoint. */
export interface PermissionResponse extends PermissionBase {
  /** URL of given permission instance (permission x user). */
  url: string
  label?: string | PartialPermissionLabel
}

/**
 * A saved export settings instance.
 */
export interface ExportSetting {
  uid: string
  url: string
  name: string
  data_url_csv: string
  data_url_xlsx: string
  date_modified: string
  export_settings: ExportSettingSettings
}

export interface ExportSettingRequest {
  name: string
  export_settings: ExportSettingSettings
}

export interface ExportSettingSettings {
  lang: ExportDataLang
  type: ExportTypeName
  fields: string[]
  group_sep: string
  multiple_select: ExportMultiOptionName
  include_media_url?: boolean
  xls_types_as_text?: boolean
  hierarchy_in_labels: boolean
  fields_from_all_versions: boolean
  query?: MongoQuery
  /** Only for GeoJSON */
  flatten?: boolean
}

/**
 * Type to capture "valid mongo queries" that are accepted in some endpoints
 * Example: date query in project exports
 *
 * TODO: This is generated by co-pilot, we should see if this needs to be expanded/improved later
 */
export interface MongoQuery<T = any> {
  [key: string]:
    | T
    | { $eq?: T; $ne?: T }
    | { $gt?: T; $gte?: T; $lt?: T; $lte?: T }
    | { $in?: T[]; $nin?: T[] }
    | { $exists?: boolean }
    | { $regex?: string | RegExp; $options?: string }
    | MongoQuery<T> // Recursive for nested queries
}

/**
 * Some properties of SurveyRow can be translated to multiple languages, that is why there is an array. If for given
 * language there is no translation, a `null` value will be placed in there
 */
export type SureveyRowOrChoiceTranslatableProp = Array<string | null>

/**
 * It represents a question from the form, a group start/end or a piece of
 * a more complex question type.
 * Interesting fact: a `SurveyRow` with the least amount of properties is group
 * end - it only has `$kuid` and `type`.
 */
export interface SurveyRow {
  $kuid: string
  type: AnyRowTypeName
  /** This is a unique identifier that includes both name and path (names of parents). */
  $xpath?: string
  $autoname?: string
  calculation?: string
  label?: SureveyRowOrChoiceTranslatableProp
  hint?: SureveyRowOrChoiceTranslatableProp
  name?: string
  required?: boolean
  // It's here because when form has `kobomatrix` row, Form Builder's "Save" button is sending a request that contains
  // it, and BE doesn't remove it. It's really a result of a bug in the code. It shouldn't be used and shouldn't be part
  // of this interface. But rather than removing it, I want to leave a trace, so that noone will add it again in future.
  // _isRepeat?: 'false'
  appearance?: string
  parameters?: string
  'kobo--matrix_list'?: string
  'kobo--rank-constraint-message'?: string
  'kobo--rank-items'?: string
  'kobo--score-choices'?: string
  'kobo--locking-profile'?: string
  /** HXL tags. */
  tags?: string[]
  select_from_list_name?: string
  /** Used by `file` type to list accepted extensions */
  'body::accept'?: string
}

export interface SurveyChoice {
  $autovalue: string
  $kuid: string
  label?: SureveyRowOrChoiceTranslatableProp
  list_name: string
  name: string
  'media::image'?: string[]
  // Possibly deprecated? Most code doesn't use it at all, old reports code was
  // using it as fallback.
  $autoname?: string
}

export interface AssetContentSettings {
  name?: string
  version?: string
  id_string?: string
  style?: FormStyleName
  form_id?: string
  title?: string
  'kobo--lock_all'?: boolean
  /** The name of the locking profile applied to whole form. */
  'kobo--locking-profile'?: string
  default_language?: string | null
}

/**
 * Represents parsed form (i.e. the spreadsheet file) contents.
 * It is quite crucial for multiple places of UI, but is not always
 * present in backend responses (performance reasons).
 */
export interface AssetContent {
  schema?: string
  survey?: SurveyRow[]
  choices?: SurveyChoice[]
  settings?: AssetContentSettings
  translated?: string[]
  /** A list of languages. */
  translations?: Array<string | null>
  // TODO: this is the default language, verify why we have this as it should be accessible from `translations` array :shrug:
  translations_0?: string | null
  /** A list of all availavble locking profiles */
  'kobo--locking-profiles'?: AssetLockingProfileDefinition[]
}

interface AssetSummary {
  geo?: boolean
  labels?: string[]
  columns?: string[]
  lock_all?: boolean
  lock_any?: boolean
  languages?: Array<LangString | null>
  row_count?: number
  default_translation?: string | null
  /** To be used in a warning about missing or poorly written question names. */
  name_quality?: {
    ok: number
    bad: number
    good: number
    total: number
    firsts: {
      ok?: {
        name: string
        index: number
        label: string[]
      }
      bad?: {
        name: string
        index: number
        label: string[]
      }
    }
  }
  naming_conflicts?: string[]
}

interface AssetAdvancedFeatures {
  transcript?: {
    /** List of question names */
    values?: string[]
    /** List of transcript enabled languages. */
    languages?: string[]
  }
  translation?: {
    /** List of question names */
    values?: string[]
    /** List of translations enabled languages. */
    languages?: string[]
  }
  qual?: {
    qual_survey?: AnalysisQuestionSchema[]
  }
}

export interface TableSortBySetting {
  fieldId: string
  value: SortValues
}

/**
 * None of these are actually stored as `null`s, but we use this interface for
 * a new settings draft too and it's simpler that way.
 */
interface AssetTableSettingsObject {
  'selected-columns'?: string[] | null
  'frozen-column'?: string | null
  'show-group-name'?: boolean | null
  'translation-index'?: number | null
  'show-hxl-tags'?: boolean | null
  'sort-by'?: TableSortBySetting | null
}

/**
 * This interface consists of properties from `AssetTableSettingsObject` and one
 * more property that holds a temporary copy of `AssetTableSettingsObject`
 */
export interface AssetTableSettings extends AssetTableSettingsObject {
  /** This is the same object as AssetTableSettings */
  'data-table'?: AssetTableSettingsObject
}

export interface AssetSettings {
  sector?: LabelValuePair | null | {}
  country?: LabelValuePair | LabelValuePair[] | null
  description?: string
  'data-table'?: AssetTableSettings
  organization?: string
  collects_pii?: LabelValuePair | null
  operational_purpose?: LabelValuePair | null
  country_codes?: string[]
}

/** This is the asset object Frontend uses with the endpoints. */
export interface AssetRequestObject {
  // NOTE: there might be a few properties in AssetResponse that should be here,
  // so please feel free to move them when you encounter a typing error.
  parent: string | null
  settings: AssetSettings
  asset_type: AssetTypeName
  report_styles: AssetResponseReportStyles
  report_custom: AssetResponseReportCustom
  map_styles: AssetMapStyles
  map_custom: {}
  content?: AssetContent
  tag_string: string
  name: string
  permissions: PermissionResponse[]
  export_settings: ExportSetting[]
  /** `data_sharing` is an empty object if never enabled before */
  data_sharing: {
    enabled?: boolean
    fields?: string[]
  }
  paired_data?: string
  advanced_features?: AssetAdvancedFeatures
}

export type AssetDownloads = Array<{
  format: string
  url: string
}>

export interface AnalysisFormJsonField {
  label: string
  name: string
  dtpath: string
  type: ResponseManualQualActionParams['type'] | 'transcript' | 'translation'
  /** Two letter language code or ?? for qualitative analysis questions */
  language: string | '??'
  source: string
  xpath: string
  settings:
    | {
        mode: string
        engine: string
      }
    | '??'
  path: string[]
  choices?: Array<{
    uuid: string
    labels: { [key: string]: string }
  }>
}

/**
 * This is the complete asset object we use throught the Frontend code. It is
 * built upon the object we get from Backend responses (i.e. we extend a few
 * properties and Backend adds few too that are not required in the
 * AssetRequestObject).
 */
export interface AssetResponse extends AssetRequestObject {
  url: string
  owner: string
  owner__username: string
  owner_label: string
  date_created: string
  last_modified_by: string | null
  summary: AssetSummary
  date_modified: string
  date_deployed?: string
  version_id: string | null
  version__content_hash?: string | null
  version_count?: number
  has_deployment: boolean
  deployed_version_id: string | null
  analysis_form_json?: {
    engines: {
      [engingeName: string]: { details: string }
    }
    additional_fields: AnalysisFormJsonField[]
  }
  deployed_versions?: {
    count: number
    next: string | null
    previous: string | null
    results: Array<{
      uid: string
      url: string
      content_hash: string
      date_deployed: string
      date_modified: string
    }>
  }
  deployment__links?: {
    url?: string
    single_url?: string
    single_once_url?: string
    offline_url?: string
    preview_url?: string
    iframe_url?: string
    single_iframe_url?: string
    single_once_iframe_url?: string
  }
  deployment__active: boolean
  deployment__data_download_links?: {
    csv_legacy: string
    csv: string
    geojson?: string
    kml_legacy: string
    spss_labels?: string
    xls_legacy: string
    xls: string
    zip_legacy: string
  }
  deployment__submission_count: number
  deployment_status: 'archived' | 'deployed' | 'draft'
  downloads: AssetDownloads
  embeds?: Array<{
    format: string
    url: string
  }>
  xform_link?: string
  hooks_link?: string
  uid: string
  kind: string
  xls_link?: string
  assignable_permissions: AssignablePermission[]
  /**
   * A list of all permissions (their codenames) that current user has in
   * regards to this asset. It is a sum of permissions assigned directly for
   * that user and ones coming from the Project View definition.
   */
  effective_permissions: Array<{ codename: PermissionCodename }>
  exports?: string
  data: string
  children: {
    count: number
  }
  subscribers_count: number
  status: string
  access_types: string[] | null
  /** If there are no files this will be empty array */
  files: AssetResponseFile[]

  // TODO: think about creating a new interface for asset that is being extended
  // on frontend.
  // See: https://github.com/kobotoolbox/kpi/issues/3905
  // Here are some properties we add to the response:
  tags?: string[]
  unparsed__settings?: AssetContentSettings
  settings__style?: string
  settings__form_id?: string
  settings__title?: string
  project_ownership: ProjectTransferAssetDetail | null
}

export interface AssetResponseFile {
  uid: string
  url: string
  /** asset url */
  asset: string
  /** user url */
  user: string
  user__username: string
  file_type: 'form_media' | string
  description: 'default' | string
  date_created: string
  /** url */
  content: string
  metadata: {
    hash: string
    filename: string
    mimetype:
      | 'image/jpeg'
      | 'video/quicktime'
      | 'audio/mpeg'
      | 'text/plain'
      | 'image/jpeg'
      | 'image/jpeg'
      | 'audio/mpeg'
      | 'audio/x-m4a'
      | string
  }
}

/** This is the asset object returned by project-views endpoint. */
export interface ProjectViewAsset {
  url: string
  asset_type: AssetTypeName
  date_modified: string
  date_created: string
  date_deployed: string | null
  last_modified_by: string | null
  owner: string
  owner__username: string
  owner_label: string
  owner__email: string
  /** Full name */
  owner__name: string
  owner__organization: string
  uid: string
  name: string
  settings: AssetSettings
  languages: Array<string | null>
  has_deployment: boolean
  deployment__active: boolean
  deployment__submission_count: number
  deployment_status: 'archived' | 'deployed' | 'draft'
}

export interface AssetsResponse extends PaginatedResponse<AssetResponse> {
  metadata?: MetadataResponse
}

export interface MetadataResponse {
  languages: string[]
  countries: string[][]
  sectors: string[][]
  organizations: string[]
}

export interface DeleteAssetResponse {
  uid: string
  assetType: AssetTypeName
}

export interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export interface PermissionDefinition {
  url: string
  name: string
  codename: PermissionCodename
  /** A list of urls pointing to permissions definitions */
  implied: string[]
  /** A list of urls pointing to permissions definitions */
  contradictory: string[]
}

export type PermissionsConfigResponse = PaginatedResponse<PermissionDefinition>

interface SocialAccount {
  provider: string
  provider_id: string
  uid: string
  last_login: string
  date_joined: string
  email: string | null
  username: string | null
}

export interface AccountResponse {
  username: string
  first_name: string
  last_name: string
  email: string
  server_time: string
  date_joined: string
  /**
   * Link to a legacy view containing list of projects. No longer used on FE.
   */
  projects_url: string
  is_superuser?: boolean
  gravatar: string
  is_staff?: boolean
  last_login: string | null
  /**
   * When this is `false`, user will be blocked from accessing anything
   * sensitive. The default value is `true`.
   */
  validated_password: boolean
  /**
   * This will be `true` for user who accepted the latest TOS. If it's missing
   * or `false`, it means that the latest TOS was not accepted.
   */
  accepted_tos?: boolean
  extra_details: AccountFieldsValues & {
    /** We store this for usage statistics only. */
    last_ui_language?: string
    project_views_settings: ProjectViewsSettings
    // JSON values are the backend reality, but we make assumptions
    [key: string]: Json | ProjectViewsSettings | undefined
  }
  git_rev:
    | {
        short: string | false
        long: string | false
        branch: string | false
        tag: string | false
      }
    | false
  social_accounts: SocialAccount[]
  // Organization details
  organization?: {
    url: string
    name: string
    uid: string
  }
  extra_details__uid: string
}

export interface AccountRequest {
  email?: string
  extra_details?: {
    name?: string
    organization?: string
    organization_website?: string
    sector?: string
    gender?: string
    bio?: string
    city?: string
    country?: string
    require_auth?: boolean
    twitter?: string
    linkedin?: string
    instagram?: string
    project_views_settings?: ProjectViewsSettings
    last_ui_language?: string
  }
  current_password?: string
  new_password?: string
}

interface UserNotLoggedInResponse {
  message: string
}

export interface TransxLanguages {
  [languageCode: string]: {
    /** Human readable and localized language name. */
    name: string
    /** A list of available services. */
    options: string[]
  }
}

export interface AssetSubscriptionsResponse {
  /** url of subscription */
  url: string
  /** url of asset */
  asset: string
  /** uid of subscription */
  uid: string
}

interface AssetSnapshotResponse {
  url: string
  uid: string
  owner: string
  date_created: string
  xml: string
  enketopreviewlink: string
  asset: string
  asset_version_id: number
  details: {
    status: string
    warnings: string[]
  }
  source: AssetContent
}

const DEFAULT_PAGE_SIZE = 100

interface ExternalServiceRequestData {
  name: string
  endpoint: string
  active: boolean
  subset_fields: string[]
  email_notification: boolean
  export_type: 'json' | 'xml'
  auth_level: 'basic_auth' | 'no_auth'
  settings: {
    custom_headers: {
      [name: string]: string
    }
  }
  payload_template: string
  username?: string
  password?: string
}

export interface DeploymentResponse {
  backend: string
  /** URL */
  identifier: string
  active: boolean
  version_id: string
  asset: AssetResponse
}

interface DataInterface {
  patchProfile: (data: AccountRequest) => JQuery.jqXHR<AccountResponse>
  [key: string]: Function
}

export interface ValidationStatusResponse {
  timestamp: number
  uid: ValidationStatusName
  /** username */
  by_whom: string
  /** HEX color */
  color?: string
  label: string
}

// TODO: this should be moved to some better place, like
// `…/actions/submissions.js` after moving it to TypeScript
export interface GetSubmissionsOptions {
  uid: string
  pageSize?: number
  page?: number
  sort?: Array<{
    /** Column name */
    id: string
    /** Is `true` for descending and `false` for ascending */
    desc: boolean
  }>
  fields?: string[]
  filter?: string
}

export interface EnketoLinkResponse {
  url: string
  version_id: string
  responseJSON?: {
    detail?: string
  }
}

export interface ExternalServiceHookResponse {
  url: string
  logs_url: string
  asset: number
  uid: string
  name: string
  /** URL */
  endpoint: string
  active: boolean
  export_type: HookExportTypeName
  auth_level: HookAuthLevelName
  success_count: number
  failed_count: number
  pending_count: number
  settings: {
    password?: string
    username?: string
    custom_headers: {
      [key: string]: string
    }
  }
  date_modified: string
  email_notification: boolean
  subset_fields: string[]
  payload_template: string
}

export interface ExternalServiceLogResponse {
  url: string
  uid: string
  submission_id: number
  tries: number
  /** See `HOOK_LOG_STATUSES` */
  status: number
  stratus_str: string
  status_code: number | null
  /** This is a SubmissionResponse stringified */
  message: string
  date_modified: string
}

export interface RetryExternalServiceLogsResponse {
  detail: string
  pending_uids: string[]
}

export type ExportDataLang = ExportFormatName | LangString

/**
 * TODO: this interface is WIP, so some of the properties might be incomplete or
 * incorrect. It was created by doing a few exports and comparing responses.
 */
export interface ExportDataResponse {
  url: string
  status: ExportStatusName
  messages: {
    error?: string
  }
  uid: string
  date_created: string
  last_submission_time: string | null
  /** URL to download the file. Stops being `null` when report is ready. */
  result: string | null
  data: {
    lang: ExportDataLang
    name: null
    type: ExportTypeName
    /** List of form row names. */
    fields: string[]
    /** Asset URL. */
    source: string
    group_sep: string
    multiple_select: ExportMultiOptionName
    include_media_url?: boolean
    xls_types_as_text?: boolean
    hierarchy_in_labels: boolean
    /** Is defined when report is ready. */
    processing_time_seconds?: number
    fields_from_all_versions: boolean
    flatten?: boolean
  }
}

export type ColorSetName = 'a' | 'b' | 'c' | 'd' | 'e'

export interface AssetMapStyles {
  colorSet?: ColorSetName
  querylimit?: string
  selectedQuestion?: string
}

export interface PairedDataItem {
  source: string
  source__name: string
  fields: string[]
  filename: string
  url: string
}

const $ajax = (o: {}) => $.ajax(Object.assign({}, { dataType: 'json', method: 'GET' }, o))

export const dataInterface: DataInterface = {
  getProfile: () => fetch(`${ROOT_URL}${endpoints.ME}`).then((response) => response.json()), // TODO replace selfProfile
  selfProfile: (): JQuery.jqXHR<AccountResponse | UserNotLoggedInResponse> =>
    $ajax({ url: `${ROOT_URL}${endpoints.ME}` }),

  apiToken: (): JQuery.jqXHR<{ token: string }> =>
    $ajax({
      url: `${ROOT_URL}/token/?format=json`,
    }),

  getUser: (userUrl: string): JQuery.jqXHR<UserResponse> =>
    $ajax({
      url: userUrl,
    }),

  logout: (): JQuery.Promise<AccountResponse | UserNotLoggedInResponse> => {
    const d = $.Deferred()
    $ajax({ url: `${ROOT_URL}/accounts/logout/`, method: 'POST' })
      .done(d.resolve)
      .fail((/*resp, etype, emessage*/) => {
        // logout request wasn't successful, but may have logged the user out
        // querying '${endpoints.ME}' can confirm if we have logged out.
        dataInterface
          .selfProfile()
          .done((data: { message?: string }) => {
            if (data.message === 'user is not logged in') {
              d.resolve(data)
            } else {
              d.reject(data)
            }
          })
          .fail(d.fail)
      })
    return d.promise()
  },

  patchProfile(data: AccountRequest): JQuery.jqXHR<AccountResponse> {
    return $ajax({
      url: `${ROOT_URL}${endpoints.ME}`,
      method: 'PATCH',
      dataType: 'json',
      contentType: 'application/json',
      data: JSON.stringify(data),
    })
  },

  listTemplates(): JQuery.jqXHR<AssetsResponse> {
    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/` + (COMMON_QUERIES.t ? `?q=${COMMON_QUERIES.t}` : ''),
    })
  },

  getCollections(
    params: {
      owner?: string
      pageSize?: number
      page?: number
    } = {},
  ): JQuery.jqXHR<AssetsResponse> {
    let q = COMMON_QUERIES.c
    if (params.owner) {
      q += ` AND owner__username__exact:${params.owner}`
    }
    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/`,
      dataType: 'json',
      data: {
        q: q,
        limit: params.pageSize || DEFAULT_PAGE_SIZE,
        page: params.page || 0,
      },
      method: 'GET',
    })
  },

  createAssetSnapshot(data: AssetResponse): JQuery.jqXHR<AssetSnapshotResponse> {
    return $ajax({
      url: `${ROOT_URL}/api/v2/asset_snapshots/`,
      method: 'POST',
      data: data,
    })
  },

  /*
   * external services
   */

  getHooks(uid: string): JQuery.jqXHR<PaginatedResponse<ExternalServiceHookResponse>> {
    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/${uid}/hooks/`,
      method: 'GET',
    })
  },

  getHook(uid: string, hookUid: string): JQuery.jqXHR<ExternalServiceHookResponse> {
    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/${uid}/hooks/${hookUid}/`,
      method: 'GET',
    })
  },

  addExternalService(uid: string, data: ExternalServiceRequestData): JQuery.jqXHR<any> {
    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/${uid}/hooks/`,
      method: 'POST',
      data: JSON.stringify(data),
      dataType: 'json',
      contentType: 'application/json',
    })
  },

  updateExternalService(uid: string, hookUid: string, data: ExternalServiceRequestData): JQuery.jqXHR<any> {
    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/${uid}/hooks/${hookUid}/`,
      method: 'PATCH',
      data: JSON.stringify(data),
      dataType: 'json',
      contentType: 'application/json',
    })
  },

  deleteExternalService(uid: string, hookUid: string): JQuery.jqXHR<any> {
    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/${uid}/hooks/${hookUid}/`,
      method: 'DELETE',
    })
  },

  getHookLogs(uid: string, hookUid: string): JQuery.jqXHR<PaginatedResponse<ExternalServiceLogResponse>> {
    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/${uid}/hooks/${hookUid}/logs/`,
      method: 'GET',
    })
  },

  getHookLog(uid: string, hookUid: string, lid: string): JQuery.jqXHR<ExternalServiceLogResponse> {
    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/${uid}/hooks/${hookUid}/logs/${lid}/`,
      method: 'GET',
    })
  },

  retryExternalServiceLogs(uid: string, hookUid: string): JQuery.jqXHR<RetryExternalServiceLogsResponse> {
    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/${uid}/hooks/${hookUid}/retry/`,
      method: 'PATCH',
    })
  },

  retryExternalServiceLog(uid: string, hookUid: string, lid: string): JQuery.jqXHR<any> {
    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/${uid}/hooks/${hookUid}/logs/${lid}/retry/`,
      method: 'PATCH',
    })
  },

  getReportData(data: {
    uid: string
    identifiers: string[]
    group_by: string
  }): JQuery.jqXHR<ReportsPaginatedResponse> {
    let identifierString
    if (data.identifiers) {
      identifierString = `?names=${data.identifiers.join(',')}`
    }
    if (data.group_by != '') {
      identifierString += `&split_by=${data.group_by}`
    }

    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/${data.uid}/reports/${identifierString}`,
    })
  },

  cloneAsset(params: {
    uid: string
    name: string
    version_id: string
    new_asset_type: AssetTypeName
    parent: string
  }): JQuery.jqXHR<any> {
    const data: { [key: string]: any } = {
      clone_from: params.uid,
    }
    if (params.name) {
      data.name = params.name
    }
    if (params.version_id) {
      data.clone_from_version_id = params.version_id
    }
    if (params.new_asset_type) {
      data.asset_type = params.new_asset_type
    }
    if (params.parent) {
      data.parent = params.parent
    }
    return $ajax({
      method: 'POST',
      url: `${ROOT_URL}/api/v2/assets/`,
      data: data,
    })
  },

  /*
   * form media
   */
  postFormMedia(uid: string, data: AssetFileRequest): JQuery.jqXHR<any> {
    return $ajax({
      method: 'POST',
      url: `${ROOT_URL}/api/v2/assets/${uid}/files/`,
      data: data,
    })
  },

  deleteFormMedia(url: string): JQuery.jqXHR<any> {
    return $ajax({
      method: 'DELETE',
      url: url,
    })
  },

  /*
   * Dynamic data attachments
   */
  attachToSource(
    assetUid: string,
    data: {
      source: string
      fields: string[]
      filename: string
    },
  ): JQuery.jqXHR<any> {
    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/${assetUid}/paired-data/`,
      method: 'POST',
      data: JSON.stringify(data),
      contentType: 'application/json',
    })
  },

  detachSource(attachmentUrl: string): JQuery.jqXHR<any> {
    return $ajax({
      url: attachmentUrl,
      method: 'DELETE',
    })
  },

  patchSource(
    attachmentUrl: string,
    data: {
      fields: string
      filename: string
    },
  ): JQuery.jqXHR<PairedDataItem> {
    return $ajax({
      url: attachmentUrl,
      method: 'PATCH',
      data: JSON.stringify(data),
      contentType: 'application/json',
    })
  },

  getAttachedSources(assetUid: string): JQuery.jqXHR<PaginatedResponse<PairedDataItem>> {
    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/${assetUid}/paired-data/`,
      method: 'GET',
    })
  },

  getSharingEnabledAssets(): JQuery.jqXHR<AssetsResponse> {
    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/?q=data_sharing__enabled:true`,
      method: 'GET',
    })
  },

  patchDataSharing(
    assetUid: string,
    data: {
      data_sharing: {
        enabled: boolean
        fields: string[]
      }
    },
  ): JQuery.jqXHR<AssetResponse> {
    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/${assetUid}/`,
      method: 'PATCH',
      data: JSON.stringify(data),
      contentType: 'application/json',
    })
  },

  /*
   * permissions
   */

  getPermissionsConfig(): JQuery.jqXHR<any> {
    return $ajax({
      url: `${ROOT_URL}/api/v2/permissions/`,
      method: 'GET',
    })
  },

  getAssetPermissions(assetUid: string): JQuery.jqXHR<PermissionResponse[]> {
    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/${assetUid}/permission-assignments/`,
      method: 'GET',
    })
  },

  bulkSetAssetPermissions(
    assetUid: string,
    perms: Array<{ user: string; permission: string }>,
  ): JQuery.jqXHR<PermissionResponse[]> {
    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/${assetUid}/permission-assignments/bulk/`,
      method: 'POST',
      data: JSON.stringify(perms),
      dataType: 'json',
      contentType: 'application/json',
    })
  },

  assignAssetPermission(assetUid: string, perm: { user: string; permission: string }): JQuery.jqXHR<any> {
    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/${assetUid}/permission-assignments/`,
      method: 'POST',
      data: JSON.stringify(perm),
      dataType: 'json',
      contentType: 'application/json',
    })
  },

  removePermission(permUrl: string): JQuery.jqXHR<any> {
    return $ajax({
      method: 'DELETE',
      url: permUrl,
    })
  },

  removeAllPermissions(assetUid: string, username: string): JQuery.jqXHR<any> {
    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/${assetUid}/permission-assignments/bulk/`,
      method: 'DELETE',
      data: {
        username: username,
      },
    })
  },

  copyPermissionsFrom(sourceUid: string, targetUid: string): JQuery.jqXHR<any> {
    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/${targetUid}/permission-assignments/clone/`,
      method: 'PATCH',
      data: {
        clone_from: sourceUid,
      },
    })
  },

  deleteAsset(params: { uid: string }): JQuery.jqXHR<DeleteAssetResponse> {
    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/${params.uid}/`,
      method: 'DELETE',
    })
  },

  subscribeToCollection(assetUrl: string): JQuery.jqXHR<AssetSubscriptionsResponse> {
    return $ajax({
      url: `${ROOT_URL}/api/v2/asset_subscriptions/`,
      data: {
        asset: assetUrl,
      },
      method: 'POST',
    })
  },

  unsubscribeFromCollection(uid: string) {
    return $ajax({
      url: `${ROOT_URL}/api/v2/asset_subscriptions/`,
      data: {
        asset__uid: uid,
      },
      method: 'GET',
    }).then((data) =>
      $ajax({
        url: data.results[0].url,
        method: 'DELETE',
      }),
    )
  },

  getImportDetails(params: { uid: string }): JQuery.jqXHR<any> {
    return $.getJSON(`${ROOT_URL}/api/v2/imports/${params.uid}/`)
  },

  getAsset(params: { url?: string; id?: string } = {}): JQuery.jqXHR<any> {
    if (params.url) {
      return $.getJSON(params.url)
    } else {
      // limit is for collections children
      return $.getJSON(`${ROOT_URL}/api/v2/assets/${params.id}/?limit=${DEFAULT_PAGE_SIZE}`)
    }
  },

  getAssetExports(assetUid: string): JQuery.jqXHR<PaginatedResponse<ExportDataResponse>> {
    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/${assetUid}/exports/`,
      data: {
        ordering: '-date_created',
        // TODO: handle pagination of this in future, for now we get "all"
        // see: https://github.com/kobotoolbox/kpi/issues/3906
        limit: 9999,
      },
    })
  },

  createAssetExport(assetUid: string, data: ExportSettingSettings): JQuery.jqXHR<ExportDataResponse> {
    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/${assetUid}/exports/`,
      method: 'POST',
      data: JSON.stringify(data),
      dataType: 'json',
      contentType: 'application/json',
    })
  },

  getAssetExport(assetUid: string, exportUid: string): JQuery.jqXHR<ExportDataResponse> {
    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/${assetUid}/exports/${exportUid}/`,
      method: 'GET',
    })
  },

  deleteAssetExport(assetUid: string, exportUid: string): JQuery.jqXHR<any> {
    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/${assetUid}/exports/${exportUid}/`,
      method: 'DELETE',
    })
  },

  getExportSettings(assetUid: string): JQuery.jqXHR<any> {
    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/${assetUid}/export-settings/`,
      // NOTE: we make an educated guess that there would be no real world
      // situations that would require more than 9999 saved settings.
      // No pagination here, sorry.
      data: { limit: 9999 },
    })
  },

  getExportSetting(assetUid: string, settingUid: string): JQuery.jqXHR<any> {
    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/${assetUid}/export-settings/${settingUid}/`,
    })
  },

  updateExportSetting(assetUid: string, settingUid: string, data: ExportSettingRequest): JQuery.jqXHR<any> {
    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/${assetUid}/export-settings/${settingUid}/`,
      method: 'PATCH',
      data: data,
    })
  },

  createExportSetting(assetUid: string, data: ExportSettingRequest): JQuery.jqXHR<any> {
    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/${assetUid}/export-settings/`,
      method: 'POST',
      data: data,
    })
  },

  deleteExportSetting(assetUid: string, settingUid: string): JQuery.jqXHR<any> {
    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/${assetUid}/export-settings/${settingUid}/`,
      method: 'DELETE',
    })
  },

  getAssetXformView(uid: string): JQuery.jqXHR<any> {
    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/${uid}/xform/`,
      dataType: 'html',
    })
  },

  _searchAssetsWithPredefinedQuery(
    params: SearchAssetsPredefinedParams,
    predefinedQuery: string,
  ): JQuery.jqXHR<AssetsResponse> {
    const searchData: AssetsRequestData = {
      q: predefinedQuery,
      limit: params.pageSize || DEFAULT_PAGE_SIZE,
      offset: 0,
    }

    if (params.page && params.pageSize) {
      searchData.offset = params.page * params.pageSize
    }

    if (params.searchPhrase) {
      searchData.q += ` AND (${params.searchPhrase})`
    }

    if (params.filterProperty && params.filterValue) {
      searchData.q += ` AND ${params.filterProperty}:${params.filterValue}`
    }

    if (params.ordering) {
      searchData.ordering = params.ordering
    }

    if (params.metadata === true) {
      searchData.metadata = 'on'
    }

    if (params.collectionsFirst === true) {
      searchData.collections_first = 'true'
    }

    if (params.status) {
      searchData.status = params.status
    }

    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/`,
      dataType: 'json',
      data: searchData,
      method: 'GET',
    })
  },

  _searchMetadataWithPredefinedQuery(params: SearchAssetsPredefinedParams, predefinedQuery: string): JQuery.jqXHR<any> {
    const searchData: AssetsMetadataRequestData = {
      q: predefinedQuery,
      limit: params.pageSize || DEFAULT_PAGE_SIZE,
      offset: 0,
    }

    if (params.page && params.pageSize) {
      searchData.offset = params.page * params.pageSize
    }

    if (params.searchPhrase) {
      searchData.q += ` AND (${params.searchPhrase})`
    }

    if (params.filterProperty && params.filterValue) {
      searchData.q += ` AND ${params.filterProperty}:"${params.filterValue}"`
    }

    if (params.ordering) {
      searchData.ordering = params.ordering
    }

    if (params.status) {
      searchData.status = params.status
    }

    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/metadata/`,
      dataType: 'json',
      data: searchData,
      method: 'GET',
    })
  },

  searchMyCollectionAssets(params: SearchAssetsPredefinedParams = {}): JQuery.jqXHR<any> {
    return this._searchAssetsWithPredefinedQuery(
      params,
      // we only want the currently viewed collection's assets
      `${COMMON_QUERIES.qbtc} AND parent__uid:${params.uid}`,
    )
  },

  searchMyLibraryAssets(params: SearchAssetsPredefinedParams = {}): JQuery.jqXHR<any> {
    // we only want orphans (assets not inside collection)
    // unless it's a search
    let query = COMMON_QUERIES.qbtc
    if (!params.searchPhrase) {
      query += ' AND parent:null'
    }

    return this._searchAssetsWithPredefinedQuery(params, query)
  },

  searchMyCollectionMetadata(params: SearchAssetsPredefinedParams = {}): JQuery.jqXHR<any> {
    return this._searchMetadataWithPredefinedQuery(
      params,
      // we only want the currently viewed collection's assets
      `${COMMON_QUERIES.qbtc} AND parent__uid:${params.uid}`,
    )
  },

  searchMyLibraryMetadata(params: SearchAssetsPredefinedParams = {}): JQuery.jqXHR<any> {
    // we only want orphans (assets not inside collection)
    // unless it's a search
    let query = COMMON_QUERIES.qbtc
    if (!params.searchPhrase) {
      query += ' AND parent:null'
    }

    return this._searchMetadataWithPredefinedQuery(params, query)
  },

  searchPublicCollections(params: SearchAssetsPredefinedParams = {}): JQuery.jqXHR<any> {
    params.status = 'public-discoverable'
    return this._searchAssetsWithPredefinedQuery(params, COMMON_QUERIES.c)
  },

  searchPublicCollectionsMetadata(params: SearchAssetsPredefinedParams = {}): JQuery.jqXHR<any> {
    params.status = 'public-discoverable'
    return this._searchMetadataWithPredefinedQuery(params, COMMON_QUERIES.c)
  },

  assetsHash(): JQuery.jqXHR<any> {
    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/hash/`,
      method: 'GET',
    })
  },

  createResource(details: AssetRequestObject): JQuery.jqXHR<any> {
    return $ajax({
      method: 'POST',
      url: `${ROOT_URL}/api/v2/assets/`,
      data: details,
    })
  },

  patchAsset(uid: string, data: AssetRequestObject): JQuery.jqXHR<any> {
    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/${uid}/`,
      method: 'PATCH',
      data: JSON.stringify(data),
      dataType: 'json',
      contentType: 'application/json',
    })
  },

  loadNextPageUrl(nextPageUrl: string): JQuery.jqXHR<any> {
    return $ajax({
      url: nextPageUrl,
      method: 'GET',
    })
  },

  deployAsset(asset: AssetResponse, redeployment: boolean): JQuery.jqXHR<DeploymentResponse> {
    const data: {
      active: boolean
      version_id?: string | null
    } = {
      active: true,
    }
    let method = 'POST'
    if (redeployment) {
      method = 'PATCH'
      data.version_id = asset.version_id
    }
    return $ajax({
      method: method,
      url: `${asset.url}deployment/`,
      data: data,
    })
  },

  setDeploymentActive(params: {
    asset: AssetResponse
    active: boolean
  }): JQuery.jqXHR<DeploymentResponse> {
    return $ajax({
      method: 'PATCH',
      url: `${params.asset.url}deployment/`,
      data: {
        active: params.active,
      },
    })
  },

  createImport(data: CreateImportRequest): JQuery.jqXHR<any> {
    const formData = new FormData()
    for (const [key, value] of recordEntries(data)) {
      formData.append(key, value as string)
    }

    return $ajax({
      method: 'POST',
      url: `${ROOT_URL}/api/v2/imports/`,
      data: formData,
      processData: false,
      contentType: false,
    })
  },

  getSubmissions(
    uid: string,
    pageSize: number = DEFAULT_PAGE_SIZE,
    page = 0,
    sort: Array<{ desc: boolean; id: string }> = [],
    fields: string[] = [],
    filter = '',
  ): JQuery.jqXHR<PaginatedResponse<SubmissionResponse>> {
    const query = `limit=${pageSize}&start=${page}`
    let s = '&sort={"_id":-1}' // default sort
    let f = ''
    if (sort.length) {
      s = sort[0].desc === true ? `&sort={"${sort[0].id}":-1}` : `&sort={"${sort[0].id}":1}`
    }
    if (fields.length) {
      f = `&fields=${JSON.stringify(fields)}`
    }

    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/${uid}/data/?${query}${s}${f}${filter}`,
      method: 'GET',
    })
  },

  getSubmission(uid: string, sid: string): JQuery.jqXHR<SubmissionResponse> {
    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/${uid}/data/${sid}/`,
      method: 'GET',
    })
  },

  duplicateSubmission(uid: string, sid: string): JQuery.jqXHR<any> {
    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/${uid}/data/${sid}/duplicate/`,
      method: 'POST',
    })
  },

  bulkPatchSubmissionsValues(
    uid: string,
    submissionIds: string[],
    data: { [questionPath: string]: any },
  ): JQuery.jqXHR<any> {
    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/${uid}/data/bulk/`,
      method: 'PATCH',
      data: {
        payload: JSON.stringify({
          submission_ids: submissionIds,
          data: data,
        }),
      },
    })
  },

  bulkPatchSubmissionsValidationStatus(uid: string, data: BulkSubmissionsRequest): JQuery.jqXHR<any> {
    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/${uid}/data/validation_statuses/`,
      method: 'PATCH',
      data: { payload: JSON.stringify(data) },
    })
  },

  bulkRemoveSubmissionsValidationStatus(uid: string, data: BulkSubmissionsRequest): JQuery.jqXHR<any> {
    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/${uid}/data/validation_statuses/`,
      method: 'DELETE',
      data: { payload: JSON.stringify(data) },
    })
  },

  updateSubmissionValidationStatus(
    uid: string,
    sid: string,
    data: { 'validation_status.uid': ValidationStatusName },
  ): JQuery.jqXHR<ValidationStatusResponse> {
    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/${uid}/data/${sid}/validation_status/`,
      method: 'PATCH',
      data: data,
    })
  },

  removeSubmissionValidationStatus(uid: string, sid: string): JQuery.jqXHR<any> {
    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/${uid}/data/${sid}/validation_status/`,
      method: 'DELETE',
    })
  },

  deleteSubmission(uid: string, sid: string): JQuery.jqXHR<any> {
    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/${uid}/data/${sid}/`,
      method: 'DELETE',
    })
  },

  bulkDeleteSubmissions(uid: string, data: BulkSubmissionsRequest): JQuery.jqXHR<any> {
    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/${uid}/data/bulk/`,
      method: 'DELETE',
      data: { payload: JSON.stringify(data) },
    })
  },

  getEnketoEditLink(uid: string, sid: string): JQuery.jqXHR<EnketoLinkResponse> {
    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/${uid}/data/${sid}/enketo/edit/?return_url=false`,
      method: 'GET',
    })
  },
  getEnketoViewLink(uid: string, sid: string): JQuery.jqXHR<EnketoLinkResponse> {
    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/${uid}/data/${sid}/enketo/view/`,
      method: 'GET',
    })
  },

  uploadAssetFile(uid: string, data: AssetFileRequest): JQuery.jqXHR<any> {
    const formData = new FormData()
    for (const [key, value] of recordEntries(data)) {
      formData.append(key, value as string)
    }

    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/${uid}/files/`,
      method: 'POST',
      data: formData,
      processData: false,
      contentType: false,
    })
  },

  getAssetFiles(uid: string, fileType: AssetFileType): JQuery.jqXHR<PaginatedResponse<AssetFileResponse>> {
    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/${uid}/files/?file_type=${fileType}`,
      method: 'GET',
    })
  },

  deleteAssetFile(assetUid: string, uid: string): JQuery.jqXHR<any> {
    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/${assetUid}/files/${uid}/`,
      method: 'DELETE',
    })
  },

  setLanguage(data: { language: string }): JQuery.jqXHR<void> {
    return $ajax({
      url: `${ROOT_URL}/i18n/setlang/`,
      method: 'POST',
      data: data,
    })
  },
}
