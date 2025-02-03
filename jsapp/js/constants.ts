import {IconName} from 'jsapp/fonts/k-icons';

/**
 * A list of all shareable constants for the application.
 */

interface IEnum {
  [val: string]: string;
}

/**
 * An enum creator function. Will create a frozen object of `foo: "foo"` pairs.
 * Will make sure the returned values are unique.
 */
export function createEnum(values: string[]): IEnum {
  const newEnum: IEnum = {};
  new Set(values).forEach((value) => {
    newEnum[value] = value;
  });
  return Object.freeze(newEnum);
}

export const ROOT_URL = (() => {
  // This is an "absolute path reference (a URL without the domain name)"
  // according to the Django docs
  let rootPathEl = document.head.querySelector<HTMLMetaElement>(
    'meta[name=kpi-root-path]'
  );
  let rootPath = '';
  if (rootPathEl === null) {
    // @ts-expect-error: ℹ️ global 'expect' indicates we're in a unit test
    if (!globalThis.expect) {
      console.error('no kpi-root-path meta tag set. defaulting to ""');
    }
  } else {
    // Strip trailing slashes
    rootPath = rootPathEl.content.replace(/\/*$/, '');
  }
  return `${window.location.protocol}//${window.location.host}${rootPath}`;
})();

export enum EnketoActions {
  edit = 'edit',
  view = 'view'
}

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

export enum KeyNames {
  Enter = 'Enter',
  Escape = 'Escape',
  Space = ' ',
}

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
  TABLE_SETTINGS: 'table-settings',
  REST_SERVICES: 'rest-services',
  FORM_LANGUAGES: 'form-languages',
  FORM_TRANSLATIONS_TABLE: 'form-translation-table',
  ASSET_TAGS: 'asset-tags',
  ENCRYPT_FORM: 'encrypt-form',
  BULK_EDIT_SUBMISSIONS: 'bulk-edit-submissions',
  TABLE_MEDIA_PREVIEW: 'table-media-preview',
  DATA_ATTACHMENT_COLUMNS: 'data-attachment-columns',
  MFA_MODALS: 'mfa-modals',
};

export const PROJECT_SETTINGS_CONTEXTS = Object.freeze({
  NEW: 'newForm',
  EXISTING: 'existingForm',
  REPLACE: 'replaceProject',
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
  {
    value: 'theme-grid pages no-text-transform',
    label: t('Grid theme + Multiple pages'),
  },
  {
    value: 'theme-grid pages',
    label: t('Grid theme + Multiple pages + headings in ALL CAPS'),
  },
];

/**
 * All possible asset types.
 */
export enum AssetTypeName {
  question = 'question',
  block = 'block',
  template = 'template',
  survey = 'survey',
  collection = 'collection',
}

interface AssetTypeDefinition {
  id: AssetTypeName;
  label: string;
}

type AssetTypes = {
  [P in AssetTypeName]: AssetTypeDefinition;
};

export const ASSET_TYPES: AssetTypes = {
  question: {
    id: AssetTypeName.question,
    label: t('question'),
  },
  block: {
    id: AssetTypeName.block,
    label: t('block'),
  },
  template: {
    id: AssetTypeName.template,
    label: t('template'),
  },
  survey: {
    id: AssetTypeName.survey,
    label: t('project'),
  },
  collection: {
    id: AssetTypeName.collection,
    label: t('collection'),
  },
};

export type AssetFileType = 'map_layer' | 'form_media';

export const ASSET_FILE_TYPES: {
  [id in AssetFileType]: {id: AssetFileType; label: string};
} = {
  map_layer: {
    id: 'map_layer',
    label: t('map layer'),
  },
  form_media: {
    id: 'form_media',
    label: t('form media'),
  },
};

export const USAGE_ASSETS_PER_PAGE = 8;

/**
 * These are the types of survey rows that users can create in FormBuilder and
 * ones that require manual data submission.
 */
export enum QuestionTypeName {
  acknowledge = 'acknowledge',
  audio = 'audio',
  'background-audio' = 'background-audio',
  barcode = 'barcode',
  calculate = 'calculate',
  date = 'date',
  datetime = 'datetime',
  decimal = 'decimal',
  'xml-external' = 'xml-external',
  file = 'file',
  geopoint = 'geopoint',
  geoshape = 'geoshape',
  geotrace = 'geotrace',
  hidden = 'hidden',
  image = 'image',
  integer = 'integer',
  kobomatrix = 'kobomatrix',
  note = 'note',
  range = 'range',
  rank = 'rank',
  score = 'score',
  select_multiple = 'select_multiple',
  select_multiple_from_file = 'select_multiple_from_file',
  select_one = 'select_one',
  select_one_from_file = 'select_one_from_file',
  text = 'text',
  time = 'time',
  video = 'video',
}

interface QuestionTypeDefinition {
  label: string;
  icon: IconName;
  id: QuestionTypeName;
}

type QuestionTypes = {
  [P in QuestionTypeName]: QuestionTypeDefinition;
};

/*
 * When adding new question type please remember to update those places:
 * 1. Add question type here to `QUESTION_TYPES` and `QuestionTypeName`
 * 2. Add new SVG icon to jsapp/svg-icons
 * 3. Add icon to row view.icons.coffee (to be configurable in Form Builder)
 * 4. If it's non-regular type, you might need to update:
 *   - isRowSpecialLabelHolder in assetUtils.ts
 *   - renderQuestionTypeIcon in assetUtils.ts
 * 5. If question doesn't hold data, update:
 *   - getDisplayData in bulkEditSubmissionsForm.es6
 *   - getDisplayedColumns in table.es6
 * 6. Update renderResponseData in submissionDataTable.tsx
 * 7. Update getSubmissionDisplayData in submissionUtils.ts
 * 8. If it's media type update renderAttachment in submissionDataTable.tsx
 */

/**
 * Definitions of user oriented question types.
 */
export const QUESTION_TYPES: QuestionTypes = Object.freeze({
  acknowledge: {
    label: t('Acknowledge'),
    icon: 'qt-acknowledge',
    id: QuestionTypeName.acknowledge,
  },
  audio: {label: t('Audio'), icon: 'qt-audio', id: QuestionTypeName.audio},
  'background-audio': {
    label: t('Background Audio'),
    icon: 'qt-background-audio',
    id: QuestionTypeName['background-audio'],
  },
  barcode: {
    label: t('Barcode / QR Code'),
    icon: 'qt-barcode',
    id: QuestionTypeName.barcode,
  },
  calculate: {
    label: t('Calculate'),
    icon: 'qt-calculate',
    id: QuestionTypeName.calculate,
  },
  date: {label: t('Date'), icon: 'qt-date', id: QuestionTypeName.date},
  datetime: {
    label: t('Date & time'),
    icon: 'qt-date-time',
    id: QuestionTypeName.datetime,
  },
  decimal: {
    label: t('Decimal'),
    icon: 'qt-decimal',
    id: QuestionTypeName.decimal,
  },
  'xml-external': {
    label: t('External XML'),
    icon: 'qt-external-xml',
    id: QuestionTypeName['xml-external'],
  },
  file: {label: t('File'), icon: 'qt-file', id: QuestionTypeName.file},
  geopoint: {
    label: t('Point'),
    icon: 'qt-point',
    id: QuestionTypeName.geopoint,
  },
  geoshape: {label: t('Area'), icon: 'qt-area', id: QuestionTypeName.geoshape},
  geotrace: {label: t('Line'), icon: 'qt-line', id: QuestionTypeName.geotrace},
  hidden: {label: t('Hidden'), icon: 'qt-hidden', id: QuestionTypeName.hidden},
  image: {label: t('Photo'), icon: 'qt-photo', id: QuestionTypeName.image},
  integer: {
    label: t('Number'),
    icon: 'qt-number',
    id: QuestionTypeName.integer,
  },
  kobomatrix: {
    label: t('Question Matrix'),
    icon: 'qt-question-matrix',
    id: QuestionTypeName.kobomatrix,
  },
  note: {label: t('Note'), icon: 'qt-note', id: QuestionTypeName.note},
  range: {label: t('Range'), icon: 'qt-range', id: QuestionTypeName.range},
  rank: {label: t('Ranking'), icon: 'qt-ranking', id: QuestionTypeName.rank},
  score: {label: t('Rating'), icon: 'qt-rating', id: QuestionTypeName.score},
  select_multiple: {
    label: t('Select Many'),
    icon: 'qt-select-many',
    id: QuestionTypeName.select_multiple,
  },
  select_multiple_from_file: {
    label: t('Select Many from File'),
    icon: 'qt-select-many-from-file',
    id: QuestionTypeName.select_multiple_from_file,
  },
  select_one: {
    label: t('Select One'),
    icon: 'qt-select-one',
    id: QuestionTypeName.select_one,
  },
  select_one_from_file: {
    label: t('Select One from File'),
    icon: 'qt-select-one-from-file',
    id: QuestionTypeName.select_one_from_file,
  },
  text: {label: t('Text'), icon: 'qt-text', id: QuestionTypeName.text},
  time: {label: t('Time'), icon: 'qt-time', id: QuestionTypeName.time},
  video: {label: t('Video'), icon: 'qt-video', id: QuestionTypeName.video},
});

/**
 * These are the types of survey rows that users can create in FormBuilder (as
 * checkboxes) and ones that have data submitted automatically.
 */
export enum MetaQuestionTypeName {
  start = 'start',
  end = 'end',
  today = 'today',
  username = 'username',
  deviceid = 'deviceid',
  phonenumber = 'phonenumber',
  audit = 'audit',
  'start-geopoint' = 'start-geopoint',
}

export const META_QUESTION_TYPES = createEnum([
  MetaQuestionTypeName.start,
  MetaQuestionTypeName.end,
  MetaQuestionTypeName.today,
  MetaQuestionTypeName.username,
  MetaQuestionTypeName.deviceid,
  MetaQuestionTypeName.phonenumber,
  MetaQuestionTypeName.audit,
  MetaQuestionTypeName['start-geopoint'],
]) as {[P in MetaQuestionTypeName]: MetaQuestionTypeName};

// submission data extras being added by backend. see both of these:
// 1. https://github.com/kobotoolbox/kobocat/blob/78133d519f7b7674636c871e3ba5670cd64a7227/onadata/apps/viewer/models/parsed_instance.py#L242-L260
// 2. https://github.com/kobotoolbox/kpi/blob/7db39015866c905edc645677d72b9c1ea16067b1/jsapp/js/constants.es6#L284-L294
export const ADDITIONAL_SUBMISSION_PROPS = createEnum([
  // match the ordering of (Python) kpi.models.import_export_task.SubmissionExportTask.COPY_FIELDS
  '_id',
  '_uuid',
  '_submission_time',
  '_validation_status',
  '_notes',
  '_status',
  '_submitted_by',
  '_tags',
  '_index',
  '__version__',
]);

export const SUPPLEMENTAL_DETAILS_PROP = '_supplementalDetails';

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

export const ACCESS_TYPES = createEnum([
  'owned',
  'shared',
  'public',
  'subscribed',
  'superuser',
]);

/**
 * These are the types of survey rows that mark the beginning of a group. They
 * don't carry any submission data.
 */
export enum GroupTypeBeginName {
  begin_group = 'begin_group',
  begin_score = 'begin_score',
  begin_rank = 'begin_rank',
  begin_kobomatrix = 'begin_kobomatrix',
  begin_repeat = 'begin_repeat',
}

export const GROUP_TYPES_BEGIN = createEnum([
  GroupTypeBeginName.begin_group,
  GroupTypeBeginName.begin_score,
  GroupTypeBeginName.begin_rank,
  GroupTypeBeginName.begin_kobomatrix,
  GroupTypeBeginName.begin_repeat,
]) as {[P in GroupTypeBeginName]: GroupTypeBeginName};

/**
 * These are the types of survey rows that mark the ending of a group. They
 * don't carry any submission data.
 */
export enum GroupTypeEndName {
  end_group = 'end_group',
  end_score = 'end_score',
  end_rank = 'end_rank',
  end_kobomatrix = 'end_kobomatrix',
  end_repeat = 'end_repeat',
}

export const GROUP_TYPES_END = createEnum([
  'end_group',
  'end_score',
  'end_rank',
  'end_kobomatrix',
  'end_repeat',
]) as {[P in GroupTypeEndName]: GroupTypeEndName};

/**
 * These are some special types of survey rows.
 */
export enum MiscRowTypeName {
  score__row = 'score__row',
  rank__level = 'rank__level',
}

// a custom question type for score
export const SCORE_ROW_TYPE = MiscRowTypeName.score__row;

// a custom question type for rank
export const RANK_LEVEL_TYPE = MiscRowTypeName.rank__level;

export const ANY_ROW_TYPE_NAMES = {
  ...QuestionTypeName,
  ...MetaQuestionTypeName,
  ...GroupTypeBeginName,
  ...GroupTypeEndName,
  ...MiscRowTypeName,
};
/**
 * These are all possible types of asset survey rows.
 */
export type AnyRowTypeName =
  | QuestionTypeName
  | MetaQuestionTypeName
  | GroupTypeBeginName
  | GroupTypeEndName
  | MiscRowTypeName;

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

export const QUERY_LIMIT_DEFAULT = 5000;

export const MAX_DISPLAYED_STRING_LENGTH = Object.freeze({
  form_media: 50,
  connect_projects: 30,
});

export enum CollectionMethodName {
  offline_url = 'offline_url',
  url = 'url',
  single_url = 'single_url',
  single_once_url = 'single_once_url',
  iframe_url = 'iframe_url',
  preview_url = 'preview_url',
  android = 'android',
}

interface CollectionMethodDefinition {
  id: CollectionMethodName;
  label: string;
  desc: string;
  /** This is being used with android application Kobo Collect option */
  url?: string;
}

type CollectionMethods = {
  [P in CollectionMethodName]: CollectionMethodDefinition;
};

export const COLLECTION_METHODS: CollectionMethods = Object.freeze({
  offline_url: {
    id: CollectionMethodName.offline_url,
    label: t('Online-Offline (multiple submission)'),
    desc: t('This allows online and offline submissions and is the best option for collecting data in the field.'),
  },
  url: {
    id: CollectionMethodName.url,
    label: t('Online-Only (multiple submissions)'),
    desc: t('This is the best option when entering many records at once on a computer, e.g. for transcribing paper records.'),
  },
  single_url: {
    id: CollectionMethodName.single_url,
    label: t('Online-Only (single submission)'),
    desc: t('This allows a single submission, and can be paired with the "return_url" parameter to redirect the user to a URL of your choice after the form has been submitted.'),
  },
  single_once_url: {
    id: CollectionMethodName.single_once_url,
    label: t('Online-only (once per respondent)'),
    desc: t('This allows your web form to only be submitted once per user, using basic protection to prevent the same user (on the same browser & device) from submitting more than once.'),
  },
  iframe_url: {
    id: CollectionMethodName.iframe_url,
    label: t('Embeddable web form code'),
    desc: t('Use this html5 code snippet to integrate your form on your own website using smaller margins.'),
  },
  preview_url: {
    id: CollectionMethodName.preview_url,
    label: t('View only'),
    desc: t('Use this version for testing, getting feedback. Does not allow submitting data.'),
  },
  android: {
    id: CollectionMethodName.android,
    label: t('Android application'),
    desc: t('Use this option to collect data in the field with your Android device.'),
    url: 'https://play.google.com/store/apps/details?id=org.koboc.collect.android&hl=en',
  },
});

export const SURVEY_DETAIL_ATTRIBUTES = Object.freeze({
  value: {
    id: 'value',
  },
  parameters: {
    id: 'parameters',
  },
});

export const FUNCTION_TYPE = Object.freeze({
  function: {
    id: 'function',
  },
});

export const FUSE_OPTIONS = {
  isCaseSensitive: false,
  includeScore: true,
  minMatchCharLength: 1,
  shouldSort: false,
  ignoreFieldNorm: true,
  threshold: 0.2,
  ignoreLocation: true,
};

export const DND_TYPES = {
  ANALYSIS_QUESTION: 'qualitative-analysis-question-row',
};
/*
  Stripe Subscription statuses that are shown as active in the UI.
  Subscriptions with a status in this array will show an option to 'Manage'.
*/
export const ACTIVE_STRIPE_STATUSES = Object.freeze([
  'active',
  'past_due',
  'trialing',
]);

/*
  The ratio of current usage / usage limit at which we display soft 'warning' messages on the frontend
*/
export const USAGE_WARNING_RATIO = 0.8;

// NOTE: The default export is mainly for tests
const constants = {
  ROOT_URL,
  HOOK_LOG_STATUSES,
  KEY_CODES,
  MODAL_TYPES,
  PROJECT_SETTINGS_CONTEXTS,
  update_states,
  AVAILABLE_FORM_STYLES,
  ASSET_TYPES,
  ASSET_FILE_TYPES,
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
  QUERY_LIMIT_DEFAULT,
  CHOICE_LISTS,
  MAX_DISPLAYED_STRING_LENGTH,
  SURVEY_DETAIL_ATTRIBUTES,
  FUNCTION_TYPE,
  USAGE_WARNING_RATIO,
};

export const HELP_ARTICLE_ANON_SUBMISSIONS_URL = 'managing_permissions.html';

export const XML_VALUES_OPTION_VALUE = 'xml_values';

export default constants;
