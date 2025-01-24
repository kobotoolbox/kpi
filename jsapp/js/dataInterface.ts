/**
 * The only file that is making calls to Backend. You shouldn't use it directly,
 * but through proper actions in `jsapp/js/actions.es6`.
 *
 * NOTE: In future all the calls from here will be moved to appropriate stores.
 */

import {ROOT_URL, COMMON_QUERIES} from './constants';
import type {LanguageCode} from 'js/components/languages/languagesStore';
import type {
  AnyRowTypeName,
  AssetTypeName,
  AssetFileType,
} from 'js/constants';
import type {PermissionCodename} from 'js/components/permissions/permConstants';
import type {Json} from './components/common/common.interfaces';
import type {ProjectViewsSettings} from './projects/customViewStore';
import type {
  AnalysisQuestionSchema,
  SubmissionAnalysisResponse,
} from './components/processing/analysis/constants';
import type {TransxObject} from './components/processing/processingActions';
import type {UserResponse} from 'js/users/userExistence.store';
import type {
  ReportsPaginatedResponse,
  AssetResponseReportStyles,
  AssetResponseReportCustom,
} from 'js/components/reports/reportsConstants';
import type {ProjectTransferAssetDetail} from 'js/components/permissions/transferProjects/transferProjects.api';
import type {SortValues} from 'js/components/submissions/tableConstants';
import type {ValidationStatusName} from 'js/components/submissions/validationStatus.constants';
import type {AssetLockingProfileDefinition} from 'jsapp/js/components/locking/lockingConstants';
import {
  type ExportFormatName,
  type ExportMultiOptionName,
  type ExportStatusName,
  type ExportTypeName,
} from './components/projectDownloads/exportsConstants';
import {type LangString} from './utils';

interface AssetsRequestData {
  q?: string;
  limit?: number;
  offset?: number;
  parent?: string;
  all_public?: boolean;
  ordering?: string;
  metadata?: string;
  collections_first?: string;
  status?: string;
}

interface AssetsMetadataRequestData {
  q?: string;
  limit?: number;
  offset?: number;
  parent?: string;
  all_public?: boolean;
  ordering?: string;
  status?: string;
}

export interface SearchAssetsPredefinedParams {
  uid?: string;
  pageSize?: number;
  page?: number;
  searchPhrase?: string;
  filterProperty?: string;
  filterValue?: string;
  ordering?: string;
  metadata?: boolean;
  collectionsFirst?: boolean;
  status?: string;
}

export interface BulkSubmissionsRequest {
  query?: {
    [id: string]: any;
  };
  confirm?: boolean;
  submission_ids?: string[];
  // Needed for updating validation status
  'validation_status.uid'?: ValidationStatusName;
}

interface AssetFileRequest {
  description: string;
  file_type: AssetFileType;
  metadata: string;
  base64Encoded: ArrayBuffer | string | null;
}

export interface CreateImportRequest {
  base64Encoded?: string | ArrayBuffer | null;
  name?: string;
  totalFiles?: number;
  /** Url of the asset that should be replaced with XLSForm */
  destination?: string;
  /** Uid of the asset that should be replaced with XLSForm */
  assetUid?: string;
  /** Causes the imported XLSForm to be added as Library Item */
  library?: boolean;
}

export interface ImportResponse {
  /** The uid of the import (not asset!) */
  uid: string;
  url: string;
  messages?: {
    updated?: Array<{
      uid: string;
      kind: string;
      summary: AssetSummary;
      owner__username: string;
    }>;
    created?: Array<{
      uid: string;
      kind: string;
      summary: AssetSummary;
      owner__username: string;
    }>;
    error?: string;
    error_type?: string;
  };
  status: 'complete' | 'created' | 'error' | 'processing';
}

export interface FailResponse {
  /**
   * This is coming from Back end and can have either the general `detail` or
   * `error`, or a list of specific errors (e.g. for specific fields).
   */
  responseJSON?: {
    detail?: string;
    error?: string;
    [fieldName: string]: string[] | string | undefined;
  };
  responseText?: string;
  status: number;
  statusText: string;
}

/** Have a list of errors for different fields. */
export interface PasswordUpdateFailResponse {
  current_password: string[];
  new_password: string[];
}

interface ProcessingResponseData {
  [questionName: string]: any;
  _id: number;
}

export type GetProcessingSubmissionsResponse =
  PaginatedResponse<ProcessingResponseData>;

export interface SubmissionAttachment {
  download_url: string;
  download_large_url: string;
  download_medium_url: string;
  download_small_url: string;
  mimetype: string;
  filename: string;
  question_xpath: string;
  instance: number;
  xform: number;
  id: number;
}

interface SubmissionSupplementalDetails {
  [questionName: string]: {
    transcript?: TransxObject;
    translation?: {
      [languageCode: LanguageCode]: TransxObject;
    };
    qual?: SubmissionAnalysisResponse[];
  };
}

/**
 * Value of a property found in `SubmissionResponse`, it can be either a built
 * in submission property (e.g. `_geolocation`) or a response to a form question
 */
export type SubmissionResponseValue =
  | string
  | string[]
  | number
  | number[]
  | null
  | object
  | SubmissionAttachment[]
  | SubmissionSupplementalDetails
  // This happens with responses to questions inside repeat groups
  | Array<{[questionName: string]: SubmissionResponseValue}>
  | undefined;

export interface SubmissionResponse {
  // `SubmissionResponseValue` covers all possible values (responses to form
  // questions and other submission properties)
  [propName: string]: SubmissionResponseValue;
  // Below are all known properties of submission response:
  __version__: string;
  _attachments: SubmissionAttachment[];
  _geolocation: number[] | null[];
  _id: number;
  _notes: string[];
  _status: string;
  _submission_time: string;
  _submitted_by: string | null;
  _tags: string[];
  _uuid: string;
  _validation_status: {
    timestamp?: number;
    uid?: ValidationStatusName;
    by_whom?: string;
    color?: string;
    label?: string;
  };
  _version_: string;
  _xform_id_string: string;
  deviceid?: string;
  end?: string;
  'formhub/uuid': string;
  'meta/instanceID': string;
  phonenumber?: string;
  start?: string;
  today?: string;
  username?: string;
  _supplementalDetails?: SubmissionSupplementalDetails;
}

interface AssignablePermissionRegular {
  url: string;
  label: string;
}

/**
 * A list of labels for partial permissions.
 *
 * WARNING: it only includes labels for `…PartialByUsers` type ("…only from
 * specific users"), so please use `CHECKBOX_LABELS` from `permConstants` file
 * instead.
 */
export interface AssignablePermissionPartialLabel {
  default: string;
  view_submissions: string;
  change_submissions: string;
  delete_submissions: string;
  validate_submissions: string;
}

interface AssignablePermissionPartial {
  url: string;
  label: AssignablePermissionPartialLabel;
}

export type AssignablePermission =
  | AssignablePermissionRegular
  | AssignablePermissionPartial;

export interface LabelValuePair {
  /** Note: the labels are always localized in the current UI language */
  label: string;
  value: string;
}

export interface PartialPermissionFilterByUsers {
  _submitted_by?: string | {$in: string[]};
}

export interface PartialPermissionFilterByResponses {
  [questionName: string]: string;
}

/**
 * Filter can have properties of both of these interfaces, thus we use union
 * type here.
 */
export type PartialPermissionFilter =
  | PartialPermissionFilterByUsers
  | PartialPermissionFilterByResponses;

export interface PartialPermission {
  url: string;
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
  filters: PartialPermissionFilter[];
}

/** Permission object to be used when making API requests. */
export interface PermissionBase {
  /** User URL */
  user: string;
  /** URL of given permission type. */
  permission: string;
  partial_permissions?: PartialPermission[];
}

interface PartialPermissionLabel {
  default: string;
  view_submissions: string;
  change_submissions: string;
  delete_submissions: string;
  validate_submissions: string;
}

/** A single permission instance for a given user coming from API endpoint. */
export interface PermissionResponse extends PermissionBase {
  /** URL of given permission instance (permission x user). */
  url: string;
  label?: string | PartialPermissionLabel;
}

/**
 * A saved export settings instance.
 */
export interface ExportSetting {
  uid: string;
  url: string;
  name: string;
  data_url_csv: string;
  data_url_xlsx: string;
  date_modified: string;
  export_settings: ExportSettingSettings;
}

export interface ExportSettingRequest {
  name: string;
  export_settings: ExportSettingSettings;
}

export interface ExportSettingSettings {
  lang: ExportDataLang;
  type: ExportTypeName;
  fields: string[];
  group_sep: string;
  multiple_select: ExportMultiOptionName;
  include_media_url?: boolean;
  xls_types_as_text?: boolean;
  hierarchy_in_labels: boolean;
  fields_from_all_versions: boolean;
  /** Only for GeoJSON */
  flatten?: boolean;
}

/**
 * It represents a question from the form, a group start/end or a piece of
 * a more complex question type.
 * Interesting fact: a `SurveyRow` with the least amount of properties is group
 * end - it only has `$kuid` and `type`.
 */
export interface SurveyRow {
  $kuid: string;
  type: AnyRowTypeName;
  /** This is a unique identifier that includes both name and path (names of parents). */
  $xpath?: string;
  $autoname?: string;
  calculation?: string;
  label?: string[];
  hint?: string[];
  name?: string;
  required?: boolean;
  _isRepeat?: boolean;
  appearance?: string;
  parameters?: string;
  'kobo--matrix_list'?: string;
  'kobo--rank-constraint-message'?: string;
  'kobo--rank-items'?: string;
  'kobo--score-choices'?: string;
  'kobo--locking-profile'?: string;
  /** HXL tags. */
  tags?: string[];
  select_from_list_name?: string;
}

export interface SurveyChoice {
  $autovalue: string;
  $kuid: string;
  label?: string[];
  list_name: string;
  name: string;
  'media::image'?: string[];
  // Possibly deprecated? Most code doesn't use it at all, old reports code was
  // using it as fallback.
  $autoname?: string;
}

export interface AssetContentSettings {
  name?: string;
  version?: string;
  id_string?: string;
  style?: string;
  form_id?: string;
  title?: string;
  'kobo--lock_all'?: boolean;
  /** The name of the locking profile applied to whole form. */
  'kobo--locking-profile'?: string;
  default_language?: string;
}

/**
 * Represents parsed form (i.e. the spreadsheet file) contents.
 * It is quite crucial for multiple places of UI, but is not always
 * present in backend responses (performance reasons).
 */
export interface AssetContent {
  schema?: string;
  survey?: SurveyRow[];
  choices?: SurveyChoice[];
  settings?: AssetContentSettings | AssetContentSettings[];
  translated?: string[];
  /** A list of languages. */
  translations?: Array<string | null>;
  /** A list of all availavble locking profiles */
  'kobo--locking-profiles'?: AssetLockingProfileDefinition[];
}

interface AssetSummary {
  geo?: boolean;
  labels?: string[];
  columns?: string[];
  lock_all?: boolean;
  lock_any?: boolean;
  languages?: Array<LangString | null>;
  row_count?: number;
  default_translation?: string | null;
  /** To be used in a warning about missing or poorly written question names. */
  name_quality?: {
    ok: number;
    bad: number;
    good: number;
    total: number;
    firsts: {
      ok?: {
        name: string;
        index: number;
        label: string[];
      };
      bad?: {
        name: string;
        index: number;
        label: string[];
      };
    };
  };
  naming_conflicts?: string[];
}

interface AdvancedSubmissionSchema {
  type: 'string' | 'object';
  $description: string;
  url?: string;
  properties?: AdvancedSubmissionSchemaDefinition;
  additionalProperties?: boolean;
  required?: string[];
  definitions?: AdvancedSubmissionSchemaDefinition;
}

export interface AssetAdvancedFeatures {
  transcript?: {
    /** List of question names */
    values?: string[];
    /** List of transcript enabled languages. */
    languages?: string[];
  };
  translation?: {
    /** List of question names */
    values?: string[];
    /** List of translations enabled languages. */
    languages?: string[];
  };
  qual?: {
    qual_survey?: AnalysisQuestionSchema[];
  };
}

interface AdvancedSubmissionSchemaDefinition {
  [name: string]: {
    type?: 'string' | 'object';
    description?: string;
    properties?: {[name: string]: {}};
    additionalProperties?: boolean;
    required?: string[];
    anyOf?: Array<{$ref: string}>;
    allOf?: Array<{$ref: string}>;
  };
}

export interface TableSortBySetting {
  fieldId: string;
  value: SortValues;
}

/**
 * None of these are actually stored as `null`s, but we use this interface for
 * a new settings draft too and it's simpler that way.
 */
interface AssetTableSettingsObject {
  'selected-columns'?: string[] | null;
  'frozen-column'?: string | null;
  'show-group-name'?: boolean | null;
  'translation-index'?: number | null;
  'show-hxl-tags'?: boolean | null;
  'sort-by'?: TableSortBySetting | null;
}

/**
 * This interface consists of properties from `AssetTableSettingsObject` and one
 * more property that holds a temporary copy of `AssetTableSettingsObject`
 */
export interface AssetTableSettings extends AssetTableSettingsObject {
  /** This is the same object as AssetTableSettings */
  'data-table'?: AssetTableSettingsObject;
}

export interface AssetSettings {
  sector?: LabelValuePair | null | {};
  country?: LabelValuePair | LabelValuePair[] | null;
  description?: string;
  'data-table'?: AssetTableSettings;
  organization?: string;
  collects_pii?: LabelValuePair | null;
  operational_purpose?: LabelValuePair | null;
  country_codes?: string[];
}

/** This is the asset object Frontend uses with the endpoints. */
interface AssetRequestObject {
  // NOTE: there might be a few properties in AssetResponse that should be here,
  // so please feel free to move them when you encounter a typing error.
  parent: string | null;
  settings: AssetSettings;
  asset_type: AssetTypeName;
  report_styles: AssetResponseReportStyles;
  report_custom: AssetResponseReportCustom;
  map_styles: {};
  map_custom: {};
  content?: AssetContent;
  tag_string: string;
  name: string;
  permissions: PermissionResponse[];
  export_settings: ExportSetting[];
  data_sharing: {};
  paired_data?: string;
  advanced_features?: AssetAdvancedFeatures;
  advanced_submission_schema?: AdvancedSubmissionSchema;
}

export type AssetDownloads = Array<{
  format: string;
  url: string;
}>;

export interface AnalysisFormJsonField {
  label: string;
  name: string;
  dtpath: string;
  type: string;
  language: string;
  source: string;
  xpath: string;
  settings: {
    mode: string;
    engine: string;
  } | '??';
  path: string[];
  choices?: Array<{
    uuid: string;
    labels: {[key: string]: string};
  }>;
}

/**
 * This is the complete asset object we use throught the Frontend code. It is
 * built upon the object we get from Backend responses (i.e. we extend a few
 * properties and Backend adds few too that are not required in the
 * AssetRequestObject).
 */
export interface AssetResponse extends AssetRequestObject {
  url: string;
  owner: string;
  owner__username: string;
  owner_label: string;
  date_created: string;
  summary: AssetSummary;
  date_modified: string;
  date_deployed?: string;
  version_id: string | null;
  version__content_hash?: string | null;
  version_count?: number;
  has_deployment: boolean;
  deployed_version_id: string | null;
  analysis_form_json?: {
    engines: {
      [engingeName: string]: {details: string};
    };
    additional_fields: AnalysisFormJsonField[];
  };
  deployed_versions?: {
    count: number;
    next: string | null;
    previous: string | null;
    results: Array<{
      uid: string;
      url: string;
      content_hash: string;
      date_deployed: string;
      date_modified: string;
    }>;
  };
  deployment__links?: {
    url?: string;
    single_url?: string;
    single_once_url?: string;
    offline_url?: string;
    preview_url?: string;
    iframe_url?: string;
    single_iframe_url?: string;
    single_once_iframe_url?: string;
  };
  deployment__active: boolean;
  deployment__data_download_links?: {
    [key in ExportTypeName]: string | undefined;
  };
  deployment__submission_count: number;
  deployment_status: 'archived' | 'deployed' | 'draft';
  downloads: AssetDownloads;
  embeds?: Array<{
    format: string;
    url: string;
  }>;
  xform_link?: string;
  hooks_link?: string;
  uid: string;
  kind: string;
  xls_link?: string;
  assignable_permissions: AssignablePermission[];
  /**
   * A list of all permissions (their codenames) that current user has in
   * regards to this asset. It is a sum of permissions assigned directly for
   * that user and ones coming from the Project View definition.
   */
  effective_permissions: Array<{codename: PermissionCodename}>;
  exports?: string;
  data: string;
  children: {
    count: number;
  };
  subscribers_count: number;
  status: string;
  access_types: string[] | null;
  files?: any[];

  // TODO: think about creating a new interface for asset that is being extended
  // on frontend.
  // See: https://github.com/kobotoolbox/kpi/issues/3905
  // Here are some properties we add to the response:
  tags?: string[];
  unparsed__settings?: AssetContentSettings;
  settings__style?: string;
  settings__form_id?: string;
  settings__title?: string;
  project_ownership: ProjectTransferAssetDetail | null;
}

/** This is the asset object returned by project-views endpoint. */
export interface ProjectViewAsset {
  url: string;
  asset_type: AssetTypeName;
  date_modified: string;
  date_created: string;
  date_deployed: string | null;
  owner: string;
  owner__username: string;
  owner_label: string;
  owner__email: string;
  /** Full name */
  owner__name: string;
  owner__organization: string;
  uid: string;
  name: string;
  settings: AssetSettings;
  languages: Array<string | null>;
  has_deployment: boolean;
  deployment__active: boolean;
  deployment__submission_count: number;
  deployment_status: 'archived' | 'deployed' | 'draft';
}

export interface AssetsResponse extends PaginatedResponse<AssetResponse> {
  metadata?: MetadataResponse;
}

export interface MetadataResponse {
  languages: string[];
  countries: string[][];
  sectors: string[][];
  organizations: string[];
}

export interface DeleteAssetResponse {
  uid: string;
  assetType: AssetTypeName;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface PermissionDefinition {
  url: string;
  name: string;
  codename: PermissionCodename;
  /** A list of urls pointing to permissions definitions */
  implied: string[];
  /** A list of urls pointing to permissions definitions */
  contradictory: string[];
}

export type PermissionsConfigResponse = PaginatedResponse<PermissionDefinition>;

interface SocialAccount {
  provider: string;
  provider_id: string;
  uid: string;
  last_login: string;
  date_joined: string;
  email: string | null;
  username: string | null;
}

export interface AccountResponse {
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  server_time: string;
  date_joined: string;
  /**
   * Link to a legacy view containing list of projects. No longer used on FE.
   */
  projects_url: string;
  is_superuser: boolean;
  gravatar: string;
  is_staff: boolean;
  last_login: string;
  /**
   * When this is `false`, user will be blocked from accessing anything
   * sensitive. The default value is `true`.
   */
  validated_password: boolean;
  /**
   * This will be `true` for user who accepted the latest TOS. If it's missing
   * or `false`, it means that the latest TOS was not accepted.
   */
  accepted_tos?: boolean;
  extra_details: {
    name: string;
    gender: string;
    sector: string;
    country: string;
    organization_type: string;
    organization: string;
    organization_website: string;
    bio: string;
    city: string;
    require_auth: boolean;
    twitter: string;
    linkedin: string;
    instagram: string;
    newsletter_subscription: boolean;
    project_views_settings: ProjectViewsSettings;
    /** We store this for usage statistics only. */
    last_ui_language?: string;
    // JSON values are the backend reality, but we make assumptions
    [key: string]: Json | ProjectViewsSettings | undefined;
  };
  git_rev: {
    // All are either a string or `false`
    short: string | boolean;
    long: string | boolean;
    branch: string | boolean;
    tag: string | boolean;
  };
  social_accounts: SocialAccount[];
  // Organization details
  organization?: {
    url: string;
    name: string;
    uid: string;
  };
}

export interface AccountRequest {
  email?: string;
  extra_details?: {
    name?: string;
    organization?: string;
    organization_website?: string;
    sector?: string;
    gender?: string;
    bio?: string;
    city?: string;
    country?: string;
    require_auth?: boolean;
    twitter?: string;
    linkedin?: string;
    instagram?: string;
    project_views_settings?: ProjectViewsSettings;
    last_ui_language?: string;
  };
  current_password?: string;
  new_password?: string;
}

interface UserNotLoggedInResponse {
  message: string;
}

export interface TransxLanguages {
  [languageCode: string]: {
    /** Human readable and localized language name. */
    name: string;
    /** A list of available services. */
    options: string[];
  };
}

export interface AssetSubscriptionsResponse {
  /** url of subscription */
  url: string;
  /** url of asset */
  asset: string;
  /** uid of subscription */
  uid: string;
}

interface AssetSnapshotResponse {
  url: string;
  uid: string;
  owner: string;
  date_created: string;
  xml: string;
  enketopreviewlink: string;
  asset: string;
  asset_version_id: number;
  details: {
    status: string;
    warnings: string[];
  };
  source: AssetContent;
}

const DEFAULT_PAGE_SIZE = 100;

interface ExternalServiceRequestData {
  name: string;
  endpoint: string;
  active: boolean;
  subset_fields: string[];
  email_notification: boolean;
  export_type: 'json' | 'xml';
  auth_level: 'basic_auth' | 'no_auth';
  settings: {
    custom_headers: {
      [name: string]: string;
    };
  };
  payload_template: string;
  username?: string;
  password?: string;
}

export interface DeploymentResponse {
  backend: string;
  /** URL */
  identifier: string;
  active: boolean;
  version_id: string;
  asset: AssetResponse;
}

interface DataInterface {
  patchProfile: (data: AccountRequest) => JQuery.jqXHR<AccountResponse>;
  [key: string]: Function;
}

export interface ValidationStatusResponse {
  timestamp: number;
  uid: ValidationStatusName;
  /** username */
  by_whom: string;
  /** HEX color */
  color: string;
  label: string;
}

// TODO: this should be moved to some better place, like
// `…/actions/submissions.es6` after moving it to TypeScript
export interface GetSubmissionsOptions {
  uid: string;
  pageSize?: number;
  page?: number;
  sort?: Array<{
    /** Column name */
    id: string;
    /** Is `true` for descending and `false` for ascending */
    desc: boolean;
  }>;
  fields?: string[];
  filter?: string;
}

export interface EnketoLinkResponse {
  url: string;
  version_id: string;
  responseJSON?: {
    detail?: string;
  };
}

export type ExportDataLang = ExportFormatName | LangString;

/**
 * TODO: this interface is WIP, so some of the properties might be incomplete or
 * incorrect. It was created by doing a few exports and comparing responses.
 */
export interface ExportDataResponse {
  url: string;
  status: ExportStatusName;
  messages: {
    error?: string;
  };
  uid: string;
  date_created: string;
  last_submission_time: string | null;
  /** URL to download the file. Stops being `null` when report is ready. */
  result: string | null;
  data: {
    lang: ExportDataLang;
    name: null;
    type: ExportTypeName;
    /** List of form row names. */
    fields: string[];
    /** Asset URL. */
    source: string;
    group_sep: string;
    multiple_select: ExportMultiOptionName;
    include_media_url?: boolean;
    xls_types_as_text?: boolean;
    hierarchy_in_labels: boolean;
    /** Is defined when report is ready. */
    processing_time_seconds?: number;
    fields_from_all_versions: boolean;
    flatten?: boolean;
  };
}

const $ajax = (o: {}) =>
  $.ajax(Object.assign({}, {dataType: 'json', method: 'GET'}, o));

export const dataInterface: DataInterface = {
  getProfile: () =>
    fetch(`${ROOT_URL}/me/`).then((response) => response.json()), // TODO replace selfProfile
  selfProfile: (): JQuery.jqXHR<AccountResponse | UserNotLoggedInResponse> =>
    $ajax({url: `${ROOT_URL}/me/`}),

  apiToken: (): JQuery.jqXHR<{token: string}> =>
    $ajax({
      url: `${ROOT_URL}/token/?format=json`,
    }),

  getUser: (userUrl: string): JQuery.jqXHR<UserResponse> =>
    $ajax({
      url: userUrl,
    }),

  logout: (): JQuery.Promise<AccountResponse | UserNotLoggedInResponse> => {
    const d = $.Deferred();
    $ajax({url: `${ROOT_URL}/accounts/logout/`, method: 'POST'})
      .done(d.resolve)
      .fail(function (/*resp, etype, emessage*/) {
        // logout request wasn't successful, but may have logged the user out
        // querying '/me/' can confirm if we have logged out.
        dataInterface
          .selfProfile()
          .done(function (data: {message?: string}) {
            if (data.message === 'user is not logged in') {
              d.resolve(data);
            } else {
              d.reject(data);
            }
          })
          .fail(d.fail);
      });
    return d.promise();
  },

  patchProfile(data: AccountRequest): JQuery.jqXHR<AccountResponse> {
    return $ajax({
      url: `${ROOT_URL}/me/`,
      method: 'PATCH',
      dataType: 'json',
      contentType: 'application/json',
      data: JSON.stringify(data),
    });
  },

  listTemplates(): JQuery.jqXHR<AssetsResponse> {
    return $ajax({
      url:
        `${ROOT_URL}/api/v2/assets/` +
        (COMMON_QUERIES.t ? `?q=${COMMON_QUERIES.t}` : ''),
    });
  },

  getCollections(
    params: {
      owner?: string;
      pageSize?: number;
      page?: number;
    } = {}
  ): JQuery.jqXHR<AssetsResponse> {
    let q = COMMON_QUERIES.c;
    if (params.owner) {
      q += ` AND owner__username__exact:${params.owner}`;
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
    });
  },

  createAssetSnapshot(
    data: AssetResponse
  ): JQuery.jqXHR<AssetSnapshotResponse> {
    return $ajax({
      url: `${ROOT_URL}/api/v2/asset_snapshots/`,
      method: 'POST',
      data: data,
    });
  },

  /*
   * external services
   */

  getHooks(uid: string): JQuery.jqXHR<any> {
    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/${uid}/hooks/`,
      method: 'GET',
    });
  },

  getHook(uid: string, hookUid: string): JQuery.jqXHR<any> {
    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/${uid}/hooks/${hookUid}/`,
      method: 'GET',
    });
  },

  addExternalService(
    uid: string,
    data: ExternalServiceRequestData
  ): JQuery.jqXHR<any> {
    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/${uid}/hooks/`,
      method: 'POST',
      data: JSON.stringify(data),
      dataType: 'json',
      contentType: 'application/json',
    });
  },

  updateExternalService(
    uid: string,
    hookUid: string,
    data: ExternalServiceRequestData
  ): JQuery.jqXHR<any> {
    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/${uid}/hooks/${hookUid}/`,
      method: 'PATCH',
      data: JSON.stringify(data),
      dataType: 'json',
      contentType: 'application/json',
    });
  },

  deleteExternalService(uid: string, hookUid: string): JQuery.jqXHR<any> {
    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/${uid}/hooks/${hookUid}/`,
      method: 'DELETE',
    });
  },

  getHookLogs(uid: string, hookUid: string): JQuery.jqXHR<any> {
    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/${uid}/hooks/${hookUid}/logs/`,
      method: 'GET',
    });
  },

  getHookLog(uid: string, hookUid: string, lid: string): JQuery.jqXHR<any> {
    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/${uid}/hooks/${hookUid}/logs/${lid}/`,
      method: 'GET',
    });
  },

  retryExternalServiceLogs(uid: string, hookUid: string): JQuery.jqXHR<any> {
    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/${uid}/hooks/${hookUid}/retry/`,
      method: 'PATCH',
    });
  },

  retryExternalServiceLog(
    uid: string,
    hookUid: string,
    lid: string
  ): JQuery.jqXHR<any> {
    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/${uid}/hooks/${hookUid}/logs/${lid}/retry/`,
      method: 'PATCH',
    });
  },

  getReportData(data: {
    uid: string;
    identifiers: string[];
    group_by: string;
  }): JQuery.jqXHR<ReportsPaginatedResponse> {
    let identifierString;
    if (data.identifiers) {
      identifierString = `?names=${data.identifiers.join(',')}`;
    }
    if (data.group_by != '') {
      identifierString += `&split_by=${data.group_by}`;
    }

    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/${data.uid}/reports/${identifierString}`,
    });
  },

  cloneAsset(params: {
    uid: string;
    name: string;
    version_id: string;
    new_asset_type: AssetTypeName;
    parent: string;
  }): JQuery.jqXHR<any> {
    const data: {[key: string]: any} = {
      clone_from: params.uid,
    };
    if (params.name) {
      data.name = params.name;
    }
    if (params.version_id) {
      data.clone_from_version_id = params.version_id;
    }
    if (params.new_asset_type) {
      data.asset_type = params.new_asset_type;
    }
    if (params.parent) {
      data.parent = params.parent;
    }
    return $ajax({
      method: 'POST',
      url: `${ROOT_URL}/api/v2/assets/`,
      data: data,
    });
  },

  /*
   * form media
   */
  postFormMedia(uid: string, data: AssetFileRequest): JQuery.jqXHR<any> {
    return $ajax({
      method: 'POST',
      url: `${ROOT_URL}/api/v2/assets/${uid}/files/`,
      data: data,
    });
  },

  deleteFormMedia(url: string): JQuery.jqXHR<any> {
    return $ajax({
      method: 'DELETE',
      url: url,
    });
  },

  /*
   * Dynamic data attachments
   */
  attachToSource(
    assetUid: string,
    data: {
      source: string;
      fields: string[];
      filename: string;
    }
  ): JQuery.jqXHR<any> {
    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/${assetUid}/paired-data/`,
      method: 'POST',
      data: JSON.stringify(data),
      contentType: 'application/json',
    });
  },

  detachSource(attachmentUrl: string): JQuery.jqXHR<any> {
    return $ajax({
      url: attachmentUrl,
      method: 'DELETE',
    });
  },

  patchSource(
    attachmentUrl: string,
    data: {
      fields: string;
      filename: string;
    }
  ): JQuery.jqXHR<any> {
    return $ajax({
      url: attachmentUrl,
      method: 'PATCH',
      data: JSON.stringify(data),
      contentType: 'application/json',
    });
  },

  getAttachedSources(assetUid: string): JQuery.jqXHR<any> {
    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/${assetUid}/paired-data/`,
      method: 'GET',
    });
  },

  getSharingEnabledAssets(): JQuery.jqXHR<AssetsResponse> {
    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/?q=data_sharing__enabled:true`,
      method: 'GET',
    });
  },

  patchDataSharing(
    assetUid: string,
    data: {
      data_sharing: {
        enabled: boolean;
        fields: string[];
      };
    }
  ): JQuery.jqXHR<any> {
    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/${assetUid}/`,
      method: 'PATCH',
      data: JSON.stringify(data),
      contentType: 'application/json',
    });
  },

  /*
   * permissions
   */

  getPermissionsConfig(): JQuery.jqXHR<any> {
    return $ajax({
      url: `${ROOT_URL}/api/v2/permissions/`,
      method: 'GET',
    });
  },

  getAssetPermissions(assetUid: string): JQuery.jqXHR<PermissionResponse[]> {
    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/${assetUid}/permission-assignments/`,
      method: 'GET',
    });
  },

  bulkSetAssetPermissions(
    assetUid: string,
    perms: Array<{user: string; permission: string}>
  ): JQuery.jqXHR<PermissionResponse[]> {
    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/${assetUid}/permission-assignments/bulk/`,
      method: 'POST',
      data: JSON.stringify(perms),
      dataType: 'json',
      contentType: 'application/json',
    });
  },

  assignAssetPermission(
    assetUid: string,
    perm: {user: string; permission: string}
  ): JQuery.jqXHR<any> {
    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/${assetUid}/permission-assignments/`,
      method: 'POST',
      data: JSON.stringify(perm),
      dataType: 'json',
      contentType: 'application/json',
    });
  },

  removePermission(permUrl: string): JQuery.jqXHR<any> {
    return $ajax({
      method: 'DELETE',
      url: permUrl,
    });
  },

  copyPermissionsFrom(sourceUid: string, targetUid: string): JQuery.jqXHR<any> {
    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/${targetUid}/permission-assignments/clone/`,
      method: 'PATCH',
      data: {
        clone_from: sourceUid,
      },
    });
  },

  deleteAsset(params: {uid: string}): JQuery.jqXHR<DeleteAssetResponse> {
    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/${params.uid}/`,
      method: 'DELETE',
    });
  },

  subscribeToCollection(
    assetUrl: string
  ): JQuery.jqXHR<AssetSubscriptionsResponse> {
    return $ajax({
      url: `${ROOT_URL}/api/v2/asset_subscriptions/`,
      data: {
        asset: assetUrl,
      },
      method: 'POST',
    });
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
      })
    );
  },

  getImportDetails(params: {uid: string}): JQuery.jqXHR<any> {
    return $.getJSON(`${ROOT_URL}/api/v2/imports/${params.uid}/`);
  },

  getAsset(params: {url?: string; id?: string} = {}): JQuery.jqXHR<any> {
    if (params.url) {
      return $.getJSON(params.url);
    } else {
      // limit is for collections children
      return $.getJSON(
        `${ROOT_URL}/api/v2/assets/${params.id}/?limit=${DEFAULT_PAGE_SIZE}`
      );
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
    });
  },

  createAssetExport(
    assetUid: string,
    data: ExportSettingSettings
  ): JQuery.jqXHR<ExportDataResponse> {
    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/${assetUid}/exports/`,
      method: 'POST',
      data: JSON.stringify(data),
      dataType: 'json',
      contentType: 'application/json',
    });
  },

  getAssetExport(assetUid: string, exportUid: string): JQuery.jqXHR<ExportDataResponse> {
    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/${assetUid}/exports/${exportUid}/`,
      method: 'GET',
    });
  },

  deleteAssetExport(assetUid: string, exportUid: string): JQuery.jqXHR<any> {
    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/${assetUid}/exports/${exportUid}/`,
      method: 'DELETE',
    });
  },

  getExportSettings(assetUid: string): JQuery.jqXHR<any> {
    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/${assetUid}/export-settings/`,
      // NOTE: we make an educated guess that there would be no real world
      // situations that would require more than 9999 saved settings.
      // No pagination here, sorry.
      data: {limit: 9999},
    });
  },

  getExportSetting(assetUid: string, settingUid: string): JQuery.jqXHR<any> {
    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/${assetUid}/export-settings/${settingUid}/`,
    });
  },

  updateExportSetting(
    assetUid: string,
    settingUid: string,
    data: ExportSettingRequest
  ): JQuery.jqXHR<any> {
    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/${assetUid}/export-settings/${settingUid}/`,
      method: 'PATCH',
      data: data,
    });
  },

  createExportSetting(
    assetUid: string,
    data: ExportSettingRequest
  ): JQuery.jqXHR<any> {
    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/${assetUid}/export-settings/`,
      method: 'POST',
      data: data,
    });
  },

  deleteExportSetting(assetUid: string, settingUid: string): JQuery.jqXHR<any> {
    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/${assetUid}/export-settings/${settingUid}/`,
      method: 'DELETE',
    });
  },

  getAssetXformView(uid: string): JQuery.jqXHR<any> {
    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/${uid}/xform/`,
      dataType: 'html',
    });
  },

  searchAssets(searchData: AssetsRequestData): JQuery.jqXHR<AssetsResponse> {
    // TODO https://github.com/kobotoolbox/kpi/issues/1983
    // force set limit to get hacky "all" assets
    searchData.limit = 200;
    return $.ajax({
      url: `${ROOT_URL}/api/v2/assets/`,
      dataType: 'json',
      data: searchData,
      method: 'GET',
    });
  },

  _searchAssetsWithPredefinedQuery(
    params: SearchAssetsPredefinedParams,
    predefinedQuery: string
  ): JQuery.jqXHR<AssetsResponse> {
    const searchData: AssetsRequestData = {
      q: predefinedQuery,
      limit: params.pageSize || DEFAULT_PAGE_SIZE,
      offset: 0,
    };

    if (params.page && params.pageSize) {
      searchData.offset = params.page * params.pageSize;
    }

    if (params.searchPhrase) {
      searchData.q += ` AND (${params.searchPhrase})`;
    }

    if (params.filterProperty && params.filterValue) {
      searchData.q += ` AND ${params.filterProperty}:${params.filterValue}`;
    }

    if (params.ordering) {
      searchData.ordering = params.ordering;
    }

    if (params.metadata === true) {
      searchData.metadata = 'on';
    }

    if (params.collectionsFirst === true) {
      searchData.collections_first = 'true';
    }

    if (params.status) {
      searchData.status = params.status;
    }

    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/`,
      dataType: 'json',
      data: searchData,
      method: 'GET',
    });
  },

  _searchMetadataWithPredefinedQuery(
    params: SearchAssetsPredefinedParams,
    predefinedQuery: string
  ): JQuery.jqXHR<any> {
    const searchData: AssetsMetadataRequestData = {
      q: predefinedQuery,
      limit: params.pageSize || DEFAULT_PAGE_SIZE,
      offset: 0,
    };

    if (params.page && params.pageSize) {
      searchData.offset = params.page * params.pageSize;
    }

    if (params.searchPhrase) {
      searchData.q += ` AND (${params.searchPhrase})`;
    }

    if (params.filterProperty && params.filterValue) {
      searchData.q += ` AND ${params.filterProperty}:"${params.filterValue}"`;
    }

    if (params.ordering) {
      searchData.ordering = params.ordering;
    }

    if (params.status) {
      searchData.status = params.status;
    }

    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/metadata/`,
      dataType: 'json',
      data: searchData,
      method: 'GET',
    });
  },

  searchMyCollectionAssets(
    params: SearchAssetsPredefinedParams = {}
  ): JQuery.jqXHR<any> {
    return this._searchAssetsWithPredefinedQuery(
      params,
      // we only want the currently viewed collection's assets
      `${COMMON_QUERIES.qbtc} AND parent__uid:${params.uid}`
    );
  },

  searchMyLibraryAssets(
    params: SearchAssetsPredefinedParams = {}
  ): JQuery.jqXHR<any> {
    // we only want orphans (assets not inside collection)
    // unless it's a search
    let query = COMMON_QUERIES.qbtc;
    if (!params.searchPhrase) {
      query += ' AND parent:null';
    }

    return this._searchAssetsWithPredefinedQuery(params, query);
  },

  searchMyCollectionMetadata(
    params: SearchAssetsPredefinedParams = {}
  ): JQuery.jqXHR<any> {
    return this._searchMetadataWithPredefinedQuery(
      params,
      // we only want the currently viewed collection's assets
      `${COMMON_QUERIES.qbtc} AND parent__uid:${params.uid}`
    );
  },

  searchMyLibraryMetadata(
    params: SearchAssetsPredefinedParams = {}
  ): JQuery.jqXHR<any> {
    // we only want orphans (assets not inside collection)
    // unless it's a search
    let query = COMMON_QUERIES.qbtc;
    if (!params.searchPhrase) {
      query += ' AND parent:null';
    }

    return this._searchMetadataWithPredefinedQuery(params, query);
  },

  searchPublicCollections(
    params: SearchAssetsPredefinedParams = {}
  ): JQuery.jqXHR<any> {
    params.status = 'public-discoverable';
    return this._searchAssetsWithPredefinedQuery(params, COMMON_QUERIES.c);
  },

  searchPublicCollectionsMetadata(
    params: SearchAssetsPredefinedParams = {}
  ): JQuery.jqXHR<any> {
    params.status = 'public-discoverable';
    return this._searchMetadataWithPredefinedQuery(params, COMMON_QUERIES.c);
  },

  assetsHash(): JQuery.jqXHR<any> {
    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/hash/`,
      method: 'GET',
    });
  },

  createResource(details: AssetRequestObject): JQuery.jqXHR<any> {
    return $ajax({
      method: 'POST',
      url: `${ROOT_URL}/api/v2/assets/`,
      data: details,
    });
  },

  patchAsset(uid: string, data: AssetRequestObject): JQuery.jqXHR<any> {
    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/${uid}/`,
      method: 'PATCH',
      data: JSON.stringify(data),
      dataType: 'json',
      contentType: 'application/json',
    });
  },

  listTags(data: {q: string}): JQuery.jqXHR<any> {
    return $ajax({
      url: `${ROOT_URL}/tags/`,
      method: 'GET',
      data: Object.assign(
        {
          // If this number is too big (e.g. 9999) it causes a deadly timeout
          // whenever Form Builder displays the aside Library search
          limit: 100,
        },
        data
      ),
    });
  },

  loadNextPageUrl(nextPageUrl: string): JQuery.jqXHR<any> {
    return $ajax({
      url: nextPageUrl,
      method: 'GET',
    });
  },

  deployAsset(
    asset: AssetResponse,
    redeployment: boolean
  ): JQuery.jqXHR<DeploymentResponse> {
    const data: {
      active: boolean;
      version_id?: string | null;
    } = {
      active: true,
    };
    let method = 'POST';
    if (redeployment) {
      method = 'PATCH';
      data.version_id = asset.version_id;
    }
    return $ajax({
      method: method,
      url: `${asset.url}deployment/`,
      data: data,
    });
  },

  setDeploymentActive(params: {
    asset: AssetResponse;
    active: boolean;
  }): JQuery.jqXHR<DeploymentResponse> {
    return $ajax({
      method: 'PATCH',
      url: `${params.asset.url}deployment/`,
      data: {
        active: params.active,
      },
    });
  },

  createImport(data: CreateImportRequest): JQuery.jqXHR<any> {
    const formData = new FormData();
    for (const [key, value] of Object.entries(data)) {
      formData.append(key, value);
    }

    return $ajax({
      method: 'POST',
      url: `${ROOT_URL}/api/v2/imports/`,
      data: formData,
      processData: false,
      contentType: false,
    });
  },

  getSubmissions(
    uid: string,
    pageSize: number = DEFAULT_PAGE_SIZE,
    page = 0,
    sort: Array<{desc: boolean; id: string}> = [],
    fields: string[] = [],
    filter = ''
  ): JQuery.jqXHR<PaginatedResponse<SubmissionResponse>> {
    const query = `limit=${pageSize}&start=${page}`;
    let s = '&sort={"_id":-1}'; // default sort
    let f = '';
    if (sort.length) {
      s =
        sort[0].desc === true
          ? `&sort={"${sort[0].id}":-1}`
          : `&sort={"${sort[0].id}":1}`;
    }
    if (fields.length) {
      f = `&fields=${JSON.stringify(fields)}`;
    }

    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/${uid}/data/?${query}${s}${f}${filter}`,
      method: 'GET',
    });
  },

  getSubmission(uid: string, sid: string): JQuery.jqXHR<SubmissionResponse> {
    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/${uid}/data/${sid}/`,
      method: 'GET',
    });
  },

  duplicateSubmission(uid: string, sid: string): JQuery.jqXHR<any> {
    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/${uid}/data/${sid}/duplicate/`,
      method: 'POST',
    });
  },

  bulkPatchSubmissionsValues(
    uid: string,
    submissionIds: string[],
    data: {[questionPath: string]: any}
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
    });
  },

  bulkPatchSubmissionsValidationStatus(
    uid: string,
    data: BulkSubmissionsRequest
  ): JQuery.jqXHR<any> {
    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/${uid}/data/validation_statuses/`,
      method: 'PATCH',
      data: {payload: JSON.stringify(data)},
    });
  },

  bulkRemoveSubmissionsValidationStatus(
    uid: string,
    data: BulkSubmissionsRequest
  ): JQuery.jqXHR<any> {
    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/${uid}/data/validation_statuses/`,
      method: 'DELETE',
      data: {payload: JSON.stringify(data)},
    });
  },

  updateSubmissionValidationStatus(
    uid: string,
    sid: string,
    data: {'validation_status.uid': ValidationStatusName}
  ): JQuery.jqXHR<ValidationStatusResponse> {
    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/${uid}/data/${sid}/validation_status/`,
      method: 'PATCH',
      data: data,
    });
  },

  removeSubmissionValidationStatus(
    uid: string,
    sid: string
  ): JQuery.jqXHR<any> {
    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/${uid}/data/${sid}/validation_status/`,
      method: 'DELETE',
    });
  },

  getSubmissionsQuery(uid: string, query = ''): JQuery.jqXHR<any> {
    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/${uid}/data/?${query}`,
      method: 'GET',
    });
  },

  deleteSubmission(uid: string, sid: string): JQuery.jqXHR<any> {
    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/${uid}/data/${sid}/`,
      method: 'DELETE',
    });
  },

  bulkDeleteSubmissions(
    uid: string,
    data: BulkSubmissionsRequest
  ): JQuery.jqXHR<any> {
    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/${uid}/data/bulk/`,
      method: 'DELETE',
      data: {payload: JSON.stringify(data)},
    });
  },

  getEnketoEditLink(uid: string, sid: string): JQuery.jqXHR<EnketoLinkResponse> {
    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/${uid}/data/${sid}/enketo/edit/?return_url=false`,
      method: 'GET',
    });
  },
  getEnketoViewLink(uid: string, sid: string): JQuery.jqXHR<EnketoLinkResponse> {
    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/${uid}/data/${sid}/enketo/view/`,
      method: 'GET',
    });
  },

  uploadAssetFile(uid: string, data: AssetFileRequest): JQuery.jqXHR<any> {
    const formData = new FormData();
    for (const [key, value] of Object.entries(data)) {
      formData.append(key, value);
    }

    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/${uid}/files/`,
      method: 'POST',
      data: formData,
      processData: false,
      contentType: false,
    });
  },

  getAssetFiles(uid: string, fileType: AssetFileType): JQuery.jqXHR<any> {
    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/${uid}/files/?file_type=${fileType}`,
      method: 'GET',
    });
  },

  deleteAssetFile(assetUid: string, uid: string): JQuery.jqXHR<any> {
    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/${assetUid}/files/${uid}/`,
      method: 'DELETE',
    });
  },

  setLanguage(data: {language: string}): JQuery.jqXHR<void> {
    return $ajax({
      url: `${ROOT_URL}/i18n/setlang/`,
      method: 'POST',
      data: data,
    });
  },
};
