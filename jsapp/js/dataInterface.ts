/**
 * The only file that is making calls to Backend. You shouldn't use it directly,
 * but through proper actions in `jsapp/js/actions.es6`.
 *
 * NOTE: In future all the calls from here will be moved to appropriate stores.
 */

import {assign} from 'js/utils';
import {
  ROOT_URL,
  COMMON_QUERIES,
} from './constants';
import type {EnvStoreFieldItem, FreeTierDisplay, SocialApp} from 'js/envStore';
import type {LanguageCode} from 'js/components/languages/languagesStore';
import type {
  AssetTypeName,
  ValidationStatus,
  AssetFileType,
  PermissionCodename,
} from 'js/constants';
import type {Json} from './components/common/common.interfaces';
import type {ProjectViewsSettings} from './projects/customViewStore';
import {FreeTierThresholds} from "js/envStore";

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

interface BulkSubmissionsRequest {
  query: {
    [id: string]: any;
  };
  confirm?: boolean;
  submission_ids?: string[];
}

interface BulkSubmissionsValidationStatusRequest extends BulkSubmissionsRequest {
  'validation_status.uid': ValidationStatus;
}

interface AssetFileRequest {
  description: string;
  file_type: AssetFileType;
  metadata: string;
  base64Encoded: ArrayBuffer | string | null;
}

export interface CreateImportRequest {
  base64Encoded?: string;
  name?: string;
  destination?: string;
  totalFiles?: number;
  assetUid?: string;
}

export interface ImportResponse {
  uid: string;
  url: string;
  messages?: {
    updated?: Array<{uid: string; kind: string; summary: AssetSummary; owner__username: string}>;
    created?: Array<{uid: string; kind: string; summary: AssetSummary; owner__username: string}>;
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
};

export interface GetProcessingSubmissionsResponse extends PaginatedResponse<ProcessingResponseData> {}

export interface SubmissionAttachment {
  download_url: string;
  download_large_url: string;
  download_medium_url: string;
  download_small_url: string;
  mimetype: string;
  filename: string;
  instance: number;
  xform: number;
  id: number;
}

interface SubmissionSupplementalDetails {
  [questionName: string]: {
    transcript?: {
      languageCode: LanguageCode
      value: string
      dateCreated: string
      dateModified: string
      engine?: string
      revisions?: {
        dateModified: string
        engine?: string
        languageCode: LanguageCode
        value: string
      }[]
    }
    translated?: {
      [languageCode: LanguageCode]: {
        languageCode: LanguageCode
        value: string
        dateCreated: string
        dateModified: string
        engine?: string
        revisions?: {
          dateModified: string
          engine?: string
          languageCode: LanguageCode
          value: string
        }[]
      }
    }
  }
}

export interface SubmissionResponse {
  [questionName: string]: any;
  __version__: string;
  _attachments: SubmissionAttachment[];
  _geolocation: any[];
  _id: number;
  _notes: any[];
  _status: string;
  _submission_time: string;
  _submitted_by: string|null;
  _tags: string[];
  _uuid: string;
  _validation_status: object;
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

interface AssignablePermission {
  url: string;
  label: string;
}

interface AssignablePermissionPartial {
  url: string;
  label: {
    default: string;
    view_submissions: string;
    change_submissions: string;
    delete_submissions: string;
    validate_submissions: string;
  };
}

export interface LabelValuePair {
  /** Note: the labels are always localized in the current UI language */
  label: string;
  value: string;
}

/**
 * A single permission instance for a given user.
 */
export interface Permission {
  url: string;
  user: string;
  permission: string;
  label: string;
  partial_permissions?: Array<{
    url: string;
    filters: Array<{_submitted_by: {$in: string[]}}>;
  }>;
}

/**
 * A saved export settings instance.
 */
interface ExportSetting {
  uid: string;
  url: string;
  name: string;
  date_modified: string;
  export_settings: ExportSettingSettings;
}

interface ExportSettingRequest {
  name: string;
  export_settings: ExportSettingSettings;
}

interface ExportSettingSettings {
  lang: string;
  type: string;
  fields: string[];
  group_sep: string;
  xls_types: boolean;
  multiple_select: string;
  hierarchy_in_labels: boolean;
  fields_from_all_versions: boolean;
}

/**
 * It represents a question from the form, a group start/end or a piece of
 * a more complex question type.
 */
export interface SurveyRow {
  /** This is a unique identifier that includes both name and path (names of parents). */
  $qpath: string;
  $autoname: string;
  $kuid: string;
  // We use dynamic import to avoid changing this ambient module to a normal
  // module: see https://stackoverflow.com/a/51114250/2311247
  type: import('js/constants').AnyRowTypeName;
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
  tags: string[]
}

export interface SurveyChoice {
  $autovalue: string;
  $kuid: string;
  label?: string[];
  list_name: string;
  name: string;
  'media::image'?: string[];
}

interface AssetLockingProfileDefinition {
  name: string;
  restrictions: string[]; // TODO make sure it's a type not a string when, see: https://github.com/kobotoolbox/kpi/issues/3904
}

export interface AssetContentSettings {
  name?: string;
  version?: string;
  id_string?: string;
  style?: string;
  form_id?: string;
  title?: string;
  'kobo--lock_all'?: boolean;
  'kobo--locking-profile'?: 'string';
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
  translations?: Array<string|null>;
  'kobo--locking-profiles'?: AssetLockingProfileDefinition[];
}

interface AssetSummary {
  geo?: boolean;
  labels?: string[];
  columns?: string[];
  lock_all?: boolean;
  lock_any?: boolean;
  languages?: Array<string|null>;
  row_count?: number;
  default_translation?: string|null;
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

interface AssetReportStylesSpecified {
  [name: string]: {};
}

interface AssetReportStylesKuidNames {
  [name: string]: {};
}

interface AdvancedSubmissionSchema {
  type: 'string' | 'object'
  $description: string
  url?: string
  properties?: AdvancedSubmissionSchemaDefinition
  additionalProperties?: boolean
  required?: string[]
  definitions?: {[name: string]: AdvancedSubmissionSchemaDefinition}
}

export interface AssetAdvancedFeatures {
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
}

interface AdvancedSubmissionSchemaDefinition {
  [name: string]: {
    type: 'string' | 'object'
    description: string
    properties?: {[name: string]: {}}
    additionalProperties?: boolean
    required?: string[]
  }
}

/**
 * None of these are actually stored as `null`s, but we use this interface for
 * a new settings draft too and it's simpler that way.
 */
export interface AssetTableSettings {
  'selected-columns'?: string[] | null;
  'frozen-column'?: string | null;
  'show-group-name'?: boolean | null;
  'translation-index'?: number | null;
  'show-hxl-tags'?: boolean | null;
  'sort-by'?: {
    fieldId: string;
    value: 'ASCENDING' | 'DESCENDING';
  } | null;
}

export interface AssetSettings {
  sector?: LabelValuePair | null;
  country?: LabelValuePair | LabelValuePair[] | null;
  description?: string;
  'data-table'?: AssetTableSettings;
  organization?: string;
  collects_pii?: LabelValuePair | null;
  operational_purpose?: LabelValuePair | null;
}

/** This is the asset object Frontend uses with the endpoints. */
interface AssetRequestObject {
  // NOTE: there might be a few properties in AssetResponse that should be here,
  // so please feel free to move them when you encounter a typing error.
  parent: string | null;
  settings: AssetSettings;
  asset_type: AssetTypeName;
  report_styles?: {
    default?: {};
    specified?: AssetReportStylesSpecified;
    kuid_names?: AssetReportStylesKuidNames;
  };
  report_custom?: {
    [reportName: string]: {
      crid: string;
      name: string;
      questions: string[];
      reportStyle: {
        groupDataBy: string;
        report_type: string;
        report_colors: string[];
        translationIndex: number;
      };
    };
  };
  map_styles?: {};
  map_custom?: {};
  content?: AssetContent;
  tag_string: string;
  name: string;
  permissions: Permission[];
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
  date_created: string;
  summary: AssetSummary;
  date_modified: string;
  version_id: string|null;
  version__content_hash?: string|null;
  version_count?: number;
  has_deployment: boolean;
  deployed_version_id: string|null;
  analysis_form_json?: any;
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
  deployment__identifier: string|null;
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
    xls_legacy?: string;
    csv_legacy?: string;
    zip_legacy?: string;
    kml_legacy?: string;
    xls?: string;
    csv?: string;
  };
  deployment__submission_count: number;
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
  assignable_permissions?: Array<AssignablePermission|AssignablePermissionPartial>;
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
  access_types: string[]|null;

  // TODO: think about creating a new interface for asset that is being extended
  // on frontend.
  // See: https://github.com/kobotoolbox/kpi/issues/3905
  // Here are some properties we add to the response:
  tags?: string[];
  unparsed__settings?: AssetContentSettings;
  settings__style?: string;
  settings__form_id?: string;
  settings__title?: string;
}

/** This is the asset object returned by project-views endpoint. */
export interface ProjectViewAsset {
  url: string;
  date_modified: string;
  date_created: string;
  date_deployed: string | null;
  owner: string;
  owner__username: string;
  owner__email: string;
  /** Full name */
  owner__name: string;
  owner__organization: string;
  uid: string;
  kind: string;
  name: string;
  settings: AssetSettings;
  languages: Array<string | null>;
  asset_type: string;
  version_id: string;
  version_count: number;
  has_deployment: boolean;
  deployed_version_id: string | null;
  deployment__active: boolean;
  deployment__submission_count: number;
  permissions: string[];
  status: string;
  data_sharing: {};
  data: string;
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
  description: string;
  codename: string;
  implied: string[];
  contradictory: string[];
}

export interface PermissionsConfigResponse extends PaginatedResponse<PermissionDefinition> {}

interface SocialAccount {
  provider: string;
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
  extra_details: {
    name: string;
    gender: string;
    sector: string;
    country: string;
    organization: string;
    organization_website: string;
    bio: string;
    city: string;
    require_auth: boolean;
    twitter: string;
    linkedin: string;
    instagram: string;
    project_views_settings: ProjectViewsSettings;
    /** We store this for usage statistics only. */
    last_ui_language?: string;
    // JSON values are the backend reality, but we make assumptions
    [key: string]: Json | ProjectViewsSettings | undefined;
  };
  git_rev: {
    short: string;
    long: string;
    branch: string;
    tag: boolean;
  };
  social_accounts: SocialAccount[];
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

export interface UserResponse {
  url: string;
  username: string;
  assets: PaginatedResponse<{url: string}>;
  date_joined: string;
  public_collection_subscribers_count: number;
  public_collections_count: number;
}

export interface TransxLanguages {
  [languageCode: string]: {
    /** Human readable and localized language name. */
    name: string;
    /** A list of available services. */
    options: string[];
  };
}

export interface EnvironmentResponse {
  terms_of_service_url: string;
  privacy_policy_url: string;
  source_code_url: string;
  support_email: string;
  support_url: string;
  community_url: string;
  project_metadata_fields: EnvStoreFieldItem[];
  user_metadata_fields: EnvStoreFieldItem[];
  sector_choices: string[][];
  operational_purpose_choices: string[][];
  country_choices: string[][];
  interface_languages: string[][];
  transcription_languages: TransxLanguages;
  translation_languages: TransxLanguages;
  submission_placeholder: string;
  frontend_min_retry_time: number;
  frontend_max_retry_time: number;
  asr_mt_features_enabled: boolean;
  mfa_localized_help_text: string;
  mfa_enabled: boolean;
  mfa_code_length: number;
  stripe_public_key: string | null;
  social_apps: SocialApp[];
  free_tier_thresholds: FreeTierThresholds;
  free_tier_display: FreeTierDisplay;
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

interface DataInterface {
  patchProfile: (data: AccountRequest) => JQuery.jqXHR<AccountResponse>;
  [key: string]: Function;
}

const $ajax = (o: {}) => $.ajax(assign({}, {dataType: 'json', method: 'GET'}, o));

export const dataInterface: DataInterface = {
  getProfile: () => fetch(`${ROOT_URL}/me/`).then((response) => response.json()),  // TODO replace selfProfile
  selfProfile: (): JQuery.jqXHR<AccountResponse | UserNotLoggedInResponse> => $ajax({url: `${ROOT_URL}/me/`}),

  apiToken: (): JQuery.jqXHR<{token: string}> => $ajax({
      url: `${ROOT_URL}/token/?format=json`,
    }),

  getUser: (userUrl: string): JQuery.jqXHR<UserResponse> => $ajax({
      url: userUrl,
    }),

  queryUserExistence: (username: string): JQuery.Promise<string, boolean> => {
    const d = $.Deferred();
    $ajax({url: `${ROOT_URL}/api/v2/users/${username}/`})
      .done(() => {d.resolve(username, true);})
      .fail(() => {d.reject(username, false);});
    return d.promise();
  },

  logout: (): JQuery.Promise<AccountResponse | UserNotLoggedInResponse> => {
    const d = $.Deferred();
    $ajax({url: `${ROOT_URL}/accounts/logout/`, method: 'POST'}).done(d.resolve).fail(function (/*resp, etype, emessage*/) {
      // logout request wasn't successful, but may have logged the user out
      // querying '/me/' can confirm if we have logged out.
      dataInterface.selfProfile().done(function (data: {message?: string}){
        if (data.message === 'user is not logged in') {
          d.resolve(data);
        } else {
          d.reject(data);
        }
      }).fail(d.fail);
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
      url: `${ROOT_URL}/api/v2/assets/` + (COMMON_QUERIES.t ? `?q=${COMMON_QUERIES.t}`: ''),
    });
  },

  getCollections(params: {
    owner?: string;
    pageSize?: number;
    page?: number;
  } = {}): JQuery.jqXHR<AssetsResponse> {
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

  createAssetSnapshot(data: AssetResponse): JQuery.jqXHR<AssetSnapshotResponse> {
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

  addExternalService(uid: string, data: ExternalServiceRequestData): JQuery.jqXHR<any> {
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

  retryExternalServiceLog(uid: string, hookUid: string, lid: string): JQuery.jqXHR<any> {
    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/${uid}/hooks/${hookUid}/logs/${lid}/retry/`,
      method: 'PATCH',
    });
  },

  getReportData(data: {
    uid: string;
    identifiers: string[];
    group_by: string;
  }): JQuery.jqXHR<any> {
    let identifierString;
    if (data.identifiers) {
      identifierString = `?names=${data.identifiers.join(',')}`;
    }
    if (data.group_by != '') {identifierString += `&split_by=${data.group_by}`;}

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
    if (params.name) {data.name = params.name;}
    if (params.version_id) {data.clone_from_version_id = params.version_id;}
    if (params.new_asset_type) {data.asset_type = params.new_asset_type;}
    if (params.parent) {data.parent = params.parent;}
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
  attachToSource(assetUid: string, data: {
    source: string;
    fields: string[];
    filename: string;
  }): JQuery.jqXHR<any> {
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

  patchSource(attachmentUrl: string, data: {
    fields: string;
    filename: string;
  }): JQuery.jqXHR<any> {
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

  patchDataSharing(assetUid: string, data: {
    data_sharing: {
      enabled: boolean;
      fields: string[];
    };
  }): JQuery.jqXHR<any> {
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

  getAssetPermissions(assetUid: string): JQuery.jqXHR<any> {
    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/${assetUid}/permission-assignments/`,
      method: 'GET',
    });
  },

  bulkSetAssetPermissions(
    assetUid: string,
    perms: Array<{user: string; permission: string}>
  ): JQuery.jqXHR<any> {
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

  subscribeToCollection(assetUrl: string): JQuery.jqXHR<AssetSubscriptionsResponse> {
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
    }).then((data) => $ajax({
        url: data.results[0].url,
        method: 'DELETE',
      }));
  },

  getImportDetails(params: {uid: string}): JQuery.jqXHR<any> {
    return $.getJSON(`${ROOT_URL}/api/v2/imports/${params.uid}/`);
  },

  getAsset(params: {url?: string; id?: string} = {}): JQuery.jqXHR<any> {
    if (params.url) {
      return $.getJSON(params.url);
    } else {
      // limit is for collections children
      return $.getJSON(`${ROOT_URL}/api/v2/assets/${params.id}/?limit=${DEFAULT_PAGE_SIZE}`);
    }
  },

  getAssetExports(assetUid: string): JQuery.jqXHR<any> {
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

  createAssetExport(assetUid: string, data: ExportSettingSettings): JQuery.jqXHR<any> {
    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/${assetUid}/exports/`,
      method: 'POST',
      data: JSON.stringify(data),
      dataType: 'json',
      contentType: 'application/json',
    });
  },

  getAssetExport(assetUid: string, exportUid: string): JQuery.jqXHR<any> {
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

  deleteExportSetting(
    assetUid: string,
    settingUid: string
  ): JQuery.jqXHR<any> {
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

  searchMyCollectionAssets(params: SearchAssetsPredefinedParams = {}): JQuery.jqXHR<any> {
    return this._searchAssetsWithPredefinedQuery(
      params,
      // we only want the currently viewed collection's assets
      `${COMMON_QUERIES.qbtc} AND parent__uid:${params.uid}`,
    );
  },

  searchMyLibraryAssets(params: SearchAssetsPredefinedParams = {}): JQuery.jqXHR<any> {
    // we only want orphans (assets not inside collection)
    // unless it's a search
    let query = COMMON_QUERIES.qbtc;
    if (!params.searchPhrase) {
      query += ' AND parent:null';
    }

    return this._searchAssetsWithPredefinedQuery(params, query);
  },

  searchMyCollectionMetadata(params: SearchAssetsPredefinedParams = {}): JQuery.jqXHR<any> {
    return this._searchMetadataWithPredefinedQuery(
      params,
      // we only want the currently viewed collection's assets
      `${COMMON_QUERIES.qbtc} AND parent__uid:${params.uid}`,
    );
  },

  searchMyLibraryMetadata(params: SearchAssetsPredefinedParams = {}): JQuery.jqXHR<any> {
    // we only want orphans (assets not inside collection)
    // unless it's a search
    let query = COMMON_QUERIES.qbtc;
    if (!params.searchPhrase) {
      query += ' AND parent:null';
    }

    return this._searchMetadataWithPredefinedQuery(params, query);
  },

  searchPublicCollections(params: SearchAssetsPredefinedParams = {}): JQuery.jqXHR<any> {
    params.status = 'public-discoverable';
    return this._searchAssetsWithPredefinedQuery(
      params,
      COMMON_QUERIES.c,
    );
  },

  searchPublicCollectionsMetadata(params: SearchAssetsPredefinedParams = {}): JQuery.jqXHR<any> {
    params.status = 'public-discoverable';
    return this._searchMetadataWithPredefinedQuery(
      params,
      COMMON_QUERIES.c,
    );
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
      data: assign({
        // If this number is too big (e.g. 9999) it causes a deadly timeout
        // whenever Form Builder displays the aside Library search
        limit: 100,
      }, data),
    });
  },

  loadNextPageUrl(nextPageUrl: string): JQuery.jqXHR<any> {
    return $ajax({
      url: nextPageUrl,
      method: 'GET',
    });
  },

  deployAsset(asset: AssetResponse, redeployment: boolean): JQuery.jqXHR<any> {
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

  setDeploymentActive(params: {asset: AssetResponse; active: boolean}): JQuery.jqXHR<any> {
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
  ): JQuery.jqXHR<any> {
    const query = `limit=${pageSize}&start=${page}`;
    let s = '&sort={"_id":-1}'; // default sort
    let f = '';
    if (sort.length) {
      s = sort[0].desc === true ? `&sort={"${sort[0].id}":-1}` : `&sort={"${sort[0].id}":1}`;
    }
    if (fields.length) {
      f = `&fields=${JSON.stringify(fields)}`;
    }

    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/${uid}/data/?${query}${s}${f}${filter}`,
      method: 'GET',
    });
  },

  getSubmission(uid: string, sid: string): JQuery.jqXHR<any> {
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
      data: {'payload': JSON.stringify({
        submission_ids: submissionIds,
        data: data,
      })},
    });
  },

  bulkPatchSubmissionsValidationStatus(
    uid: string,
    data: BulkSubmissionsValidationStatusRequest
  ): JQuery.jqXHR<any> {
    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/${uid}/data/validation_statuses/`,
      method: 'PATCH',
      data: {'payload': JSON.stringify(data)},
    });
  },

  bulkRemoveSubmissionsValidationStatus(
    uid: string,
    data: BulkSubmissionsValidationStatusRequest
  ): JQuery.jqXHR<any> {
    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/${uid}/data/validation_statuses/`,
      method: 'DELETE',
      data: {'payload': JSON.stringify(data)},
    });
  },

  updateSubmissionValidationStatus(
    uid: string,
    sid: string,
    data: {'validation_status.uid': ValidationStatus}
  ): JQuery.jqXHR<any> {
    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/${uid}/data/${sid}/validation_status/`,
      method: 'PATCH',
      data: data,
    });
  },

  removeSubmissionValidationStatus(uid: string, sid: string): JQuery.jqXHR<any> {
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

  bulkDeleteSubmissions(uid: string, data: BulkSubmissionsRequest): JQuery.jqXHR<any> {
    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/${uid}/data/bulk/`,
      method: 'DELETE',
      data: {'payload': JSON.stringify(data)},
    });
  },

  getEnketoEditLink(uid: string, sid: string): JQuery.jqXHR<any> {
    return $ajax({
      url: `${ROOT_URL}/api/v2/assets/${uid}/data/${sid}/enketo/edit/?return_url=false`,
      method: 'GET',
    });
  },
  getEnketoViewLink(uid: string, sid: string): JQuery.jqXHR<any> {
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

  environment(): JQuery.jqXHR<EnvironmentResponse> {
    return $ajax({url: `${ROOT_URL}/environment/`});
  },
};
