/**
 * A list of all shareable constants for the application.
 */

export const ROOT_URL = (() => {
  // This is an "absolute path reference (a URL without the domain name)"
  // according to the Django docs
  let rootPath = document.head.querySelector('meta[name=kpi-root-path]');
  if (rootPath === null) {
    console.error('no kpi-root-path meta tag set. defaulting to ""');
    rootPath = '';
  } else {
    // Strip trailing slashes
    rootPath = rootPath.content.replace(/\/*$/, '');
  }
  return `${window.location.protocol}//${window.location.host}${rootPath}`;
})();

export const ANON_USERNAME = 'AnonymousUser';

/**
 * BAD CODE™ A hardcoded list of permissions codenames.
 *
 * All of them are really defined on backend, and we get them through the
 * permissions config endpoint, but as we need these names to reference them in
 * the code to build the UI it's a necessary evil.
 *
 * NOTE: to know what these permissions permit see `kpi/permissions.py` file,
 * where you have to match the classes with endpoints and their HTTP methods.
 */
export const PERMISSIONS_CODENAMES = {};
new Set([
  'view_asset',
  'change_asset',
  'discover_asset',
  'manage_asset',
  'add_submissions',
  'view_submissions',
  'partial_submissions',
  'change_submissions',
  'delete_submissions',
  'validate_submissions',
]).forEach((codename) => {PERMISSIONS_CODENAMES[codename] = codename;});
Object.freeze(PERMISSIONS_CODENAMES);

export const HOOK_LOG_STATUSES = {
  SUCCESS: 2,
  PENDING: 1,
  FAILED: 0,
};

export const KEY_CODES = Object.freeze({
  TAB: 9,
  ENTER: 13,
  ESC: 27,
  SPACE: 32,
  NBSP: 160, // non-breakable space
});

export const MODAL_TYPES = {
  SHARING: 'sharing',
  UPLOADING_XLS: 'uploading-xls',
  NEW_FORM: 'new-form',
  LIBRARY_NEW_ITEM: 'library-new-item',
  LIBRARY_TEMPLATE: 'library-template',
  LIBRARY_COLLECTION: 'library-collection',
  LIBRARY_UPLOAD: 'library-upload',
  ENKETO_PREVIEW: 'enketo-preview',
  SUBMISSION: 'submission',
  REPLACE_PROJECT: 'replace-project',
  TABLE_COLUMNS: 'table-columns',
  REST_SERVICES: 'rest-services',
  FORM_LANGUAGES: 'form-languages',
  FORM_TRANSLATIONS_TABLE: 'form-translation-table',
  ASSET_TAGS: 'asset-tags',
  ENCRYPT_FORM: 'encrypt-form',
  BULK_EDIT_SUBMISSIONS: 'bulk-edit-submissions',
};

export const PROJECT_SETTINGS_CONTEXTS = Object.freeze({
  NEW: 'newForm',
  EXISTING: 'existingForm',
  REPLACE: 'replaceProject',
  BUILDER: 'formBuilderAside',
});

export const update_states = {
  UNSAVED_CHANGES: -1,
  UP_TO_DATE: true,
  PENDING_UPDATE: false,
  SAVE_FAILED: 'SAVE_FAILED',
};

export const AVAILABLE_FORM_STYLES = [
  {value: '', label: t('Default - single page')},
  {value: 'theme-grid no-text-transform', label: t('Grid theme')},
  {value: 'theme-grid', label: t('Grid theme with headings in ALL CAPS')},
  {value: 'pages', label: t('Multiple pages')},
  {value: 'theme-grid pages no-text-transform', label: t('Grid theme + Multiple pages')},
  {value: 'theme-grid pages', label: t('Grid theme + Multiple pages + headings in ALL CAPS')},
];

export const VALIDATION_STATUSES = {
  no_status: {
    value: null,
    label: '—',
  },
  validation_status_not_approved: {
    value: 'validation_status_not_approved',
    label: t('Not Approved'),
  },
  validation_status_approved: {
    value: 'validation_status_approved',
    label: t('Approved'),
  },
  validation_status_on_hold: {
    value: 'validation_status_on_hold',
    label: t('On Hold'),
  },
};

export const VALIDATION_STATUSES_LIST = [
  VALIDATION_STATUSES.no_status,
  VALIDATION_STATUSES.validation_status_not_approved,
  VALIDATION_STATUSES.validation_status_approved,
  VALIDATION_STATUSES.validation_status_on_hold,
];

export const ASSET_TYPES = {
  question: {
    id: 'question',
    label: t('question'),
  },
  block: {
    id: 'block',
    label: t('block'),
  },
  template: {
    id: 'template',
    label: t('template'),
  },
  survey: {
    id: 'survey',
    label: t('project'),
  },
  collection: {
    id: 'collection',
    label: t('collection'),
  },
};

export const QUESTION_TYPES = Object.freeze({
  acknowledge: {label: t('Acknowledge'), icon: 'qt-acknowledge', id: 'acknowledge'},
  audio: {label: t('Audio'), icon: 'qt-audio', id: 'audio'},
  barcode: {label: t('Barcode / QR Code'), icon: 'qt-barcode', id: 'barcode'},
  calculate: {label: t('Calculate'), icon: 'qt-calculate', id: 'calculate'},
  date: {label: t('Date'), icon: 'qt-date', id: 'date'},
  datetime: {label: t('Date & time'), icon: 'qt-date-time', id: 'datetime'},
  decimal: {label: t('Decimal'), icon: 'qt-decimal', id: 'decimal'},
  'external-xml': {label: t('External XML'), icon: 'qt-external-xml', id: 'external-xml'},
  file: {label: t('File'), icon: 'qt-file', id: 'file'},
  geopoint: {label: t('Point'), icon: 'qt-point', id: 'geopoint'},
  geoshape: {label: t('Area'), icon: 'qt-area', id: 'geoshape'},
  geotrace: {label: t('Line'), icon: 'qt-line', id: 'geotrace'},
  hidden: {label: t('Hidden'), icon: 'qt-hidden', id: 'hidden'},
  image: {label: t('Photo'), icon: 'qt-photo', id: 'image'},
  integer: {label: t('Number'), icon: 'qt-number', id: 'integer'},
  kobomatrix: {label: t('Question Matrix'), icon: 'qt-question-matrix', id: 'kobomatrix'},
  note: {label: t('Note'), icon: 'qt-note', id: 'note'},
  range: {label: t('Range'), icon: 'qt-range', id: 'range'},
  rank: {label: t('Ranking'), icon: 'qt-ranking', id: 'rank'},
  score: {label: t('Rating'), icon: 'qt-rating', id: 'score'},
  select_multiple: {label: t('Select Many'), icon: 'qt-select-many', id: 'select_multiple'},
  select_one: {label: t('Select One'), icon: 'qt-select-one', id: 'select_one'},
  text: {label: t('Text'), icon: 'qt-text', id: 'text'},
  time: {label: t('Time'), icon: 'qt-time', id: 'time'},
  video: {label: t('Video'), icon: 'qt-video', id: 'video'},
});

export const META_QUESTION_TYPES = {};
new Set([
  'start',
  'end',
  'today',
  'username',
  'simserial',
  'subscriberid',
  'deviceid',
  'phonenumber',
  'audit',
]).forEach((codename) => {META_QUESTION_TYPES[codename] = codename;});
Object.freeze(META_QUESTION_TYPES);

// submission data extras being added by backend. see both of these:
// 1. https://github.com/kobotoolbox/kobocat/blob/78133d519f7b7674636c871e3ba5670cd64a7227/onadata/apps/viewer/models/parsed_instance.py#L242-L260
// 2. https://github.com/kobotoolbox/kpi/blob/7db39015866c905edc645677d72b9c1ea16067b1/jsapp/js/constants.es6#L284-L294
export const ADDITIONAL_SUBMISSION_PROPS = {};
new Set([
  // match the ordering of (Python) kpi.models.import_export_task.ExportTask.COPY_FIELDS
  '_id',
  '_uuid',
  '_submission_time',
  '_validation_status',
  '_notes',
  '_status',
  '_submitted_by',
  '_tags',
]).forEach((codename) => {ADDITIONAL_SUBMISSION_PROPS[codename] = codename;});
Object.freeze(ADDITIONAL_SUBMISSION_PROPS);

export const NAME_MAX_LENGTH = 255;

/**
 * for Backend calls, see their definitions at `kpi/filters.py`
 * NOTE: ORs require a parenthesis to work
 */
export const COMMON_QUERIES = Object.freeze({
  b: 'asset_type:block',
  q: 'asset_type:question',
  t: 'asset_type:template',
  s: 'asset_type:survey',
  c: 'asset_type:collection',
  qb: '(asset_type:question OR asset_type:block)',
  qbt: '(asset_type:question OR asset_type:block OR asset_type:template)',
  qbtc: '(asset_type:question OR asset_type:block OR asset_type:template OR asset_type:collection)',
});

export const ACCESS_TYPES = {};
new Set([
  'owned',
  'shared',
  'public',
  'subscribed',
]).forEach((codename) => {ACCESS_TYPES[codename] = codename;});
Object.freeze(ACCESS_TYPES);

export const GROUP_TYPES_BEGIN = {};
new Set([
  'begin_group',
  'begin_score',
  'begin_rank',
  'begin_kobomatrix',
  'begin_repeat',
]).forEach((kind) => {GROUP_TYPES_BEGIN[kind] = kind;});
Object.freeze(GROUP_TYPES_BEGIN);

export const GROUP_TYPES_END = {};
new Set([
  'end_group',
  'end_score',
  'end_rank',
  'end_kobomatrix',
  'end_repeat',
]).forEach((kind) => {GROUP_TYPES_END[kind] = kind;});
Object.freeze(GROUP_TYPES_END);

// a custom question type for score
export const SCORE_ROW_TYPE = 'score__row';

// a custom question type for rank
export const RANK_LEVEL_TYPE = 'rank__level';

export const CHOICE_LISTS = Object.freeze({
  SELECT: 'select_from_list_name',
  MATRIX: 'kobo--matrix_list',
  SCORE: 'kobo--score-choices',
  RANK: 'kobo--rank-items',
});

export const MATRIX_PAIR_PROPS = {
  inSurvey: CHOICE_LISTS.MATRIX,
  inChoices: 'list_name',
};

export const DEPLOYMENT_CATEGORIES = Object.freeze({
  Deployed: {id: 'Deployed', label: t('Deployed')},
  Draft: {id: 'Draft', label: t('Draft')},
  Archived: {id: 'Archived', label: t('Archived')},
});

export const REPORT_STYLES = Object.freeze({
  vertical: {value: 'vertical', label: t('Vertical')},
  donut: {value: 'donut', label: t('Donut')},
  area: {value: 'area', label: t('Area')},
  horizontal: {value: 'horizontal', label: t('Horizontal')},
  pie: {value: 'pie', label: t('Pie')},
  line: {value: 'line', label: t('Line')},
});

export const QUERY_LIMIT_DEFAULT = 5000;

export const ROUTES = Object.freeze({
  ACCOUNT_SETTINGS: '/account-settings',
  CHANGE_PASSWORD: '/change-password',
  LIBRARY: '/library',
  MY_LIBRARY: '/library/my-library',
  PUBLIC_COLLECTIONS: '/library/public-collections',
  NEW_LIBRARY_ITEM: '/library/asset/new',
  LIBRARY_ITEM: '/library/asset/:uid',
  EDIT_LIBRARY_ITEM: '/library/asset/:uid/edit',
  NEW_LIBRARY_CHILD: '/library/asset/:uid/new',
  LIBRARY_ITEM_JSON: '/library/asset/:uid/json',
  LIBRARY_ITEM_XFORM: '/library/asset/:uid/xform',
  FORMS: '/forms',
  FORM: '/forms/:uid',
  FORM_JSON: '/forms/:uid/json',
  FORM_XFORM: '/forms/:uid/xform',
  FORM_EDIT: '/forms/:uid/edit',
  FORM_SUMMARY: '/forms/:uid/summary',
  FORM_LANDING: '/forms/:uid/landing',
  FORM_DATA: '/forms/:uid/data',
  FORM_REPORT: '/forms/:uid/data/report',
  FORM_REPORT_OLD: '/forms/:uid/data/report-legacy',
  FORM_TABLE: '/forms/:uid/data/table',
  FORM_DOWNLOADS: '/forms/:uid/data/downloads',
  FORM_GALLERY: '/forms/:uid/data/gallery',
  FORM_MAP: '/forms/:uid/data/map',
  FORM_MAP_BY: '/forms/:uid/data/map/:viewby',
  FORM_SETTINGS: '/forms/:uid/settings',
  FORM_MEDIA: '/forms/:uid/settings/media',
  FORM_SHARING: '/forms/:uid/settings/sharing',
  FORM_REST: '/forms/:uid/settings/rest',
  FORM_REST_HOOK: '/forms/:uid/settings/rest/:hookUid',
  FORM_KOBOCAT: '/forms/:uid/settings/kobocat',
  FORM_RESET: '/forms/:uid/reset',
});

const constants = {
  ROOT_URL,
  ANON_USERNAME,
  PERMISSIONS_CODENAMES,
  HOOK_LOG_STATUSES,
  KEY_CODES,
  MODAL_TYPES,
  PROJECT_SETTINGS_CONTEXTS,
  update_states,
  AVAILABLE_FORM_STYLES,
  VALIDATION_STATUSES,
  VALIDATION_STATUSES_LIST,
  ASSET_TYPES,
  QUESTION_TYPES,
  META_QUESTION_TYPES,
  ADDITIONAL_SUBMISSION_PROPS,
  NAME_MAX_LENGTH,
  COMMON_QUERIES,
  ACCESS_TYPES,
  GROUP_TYPES_BEGIN,
  GROUP_TYPES_END,
  SCORE_ROW_TYPE,
  RANK_LEVEL_TYPE,
  DEPLOYMENT_CATEGORIES,
  REPORT_STYLES,
  ROUTES,
  QUERY_LIMIT_DEFAULT,
  CHOICE_LISTS,
};

export default constants;
