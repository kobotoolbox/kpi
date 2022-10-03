import {
  createEnum,
  QUESTION_TYPES,
  META_QUESTION_TYPES,
  ADDITIONAL_SUBMISSION_PROPS,
} from 'js/constants';

export const SUBMISSION_ACTIONS_ID = '__SubmissionActions';

export const VALIDATION_STATUS_ID_PROP = '_validation_status.uid';

// Columns that will be ALWAYS excluded from the view
export const EXCLUDED_COLUMNS = [
  '_xform_id_string',
  '_attachments',
  '_notes',
  '_bamboo_dataset_id',
  // '_status' is always 'submitted_via_web' unless submitted in bulk
  // in that case, it's 'zip'
  '_status',
  'formhub/uuid',
  '_tags',
  '_geolocation',
  'meta/instanceID',
  'meta/deprecatedID',
  '_validation_status',
];

export const SORT_VALUES = createEnum([
  'ASCENDING',
  'DESCENDING',
]);

// This is the setting object name from `asset.settings`
export const DATA_TABLE_SETTING = 'data-table';
// These are all possible settings of the above
export const DATA_TABLE_SETTINGS = Object.freeze({
  SELECTED_COLUMNS: 'selected-columns',
  FROZEN_COLUMN: 'frozen-column',
  SHOW_GROUP: 'show-group-name',
  TRANSLATION: 'translation-index',
  SHOW_HXL: 'show-hxl-tags',
  SORT_BY: 'sort-by',
});

export const TABLE_MEDIA_TYPES = createEnum([
  QUESTION_TYPES.image.id,
  QUESTION_TYPES.audio.id,
  QUESTION_TYPES.video.id,
  QUESTION_TYPES.text.id,
  META_QUESTION_TYPES['background-audio'],
]);

export const DEFAULT_DATA_CELL_WIDTH = 140;

interface CellsWidthOverrides {
  [key: string]: number;
}

export const CELLS_WIDTH_OVERRIDES: CellsWidthOverrides = {};
CELLS_WIDTH_OVERRIDES[VALIDATION_STATUS_ID_PROP] = 125;
CELLS_WIDTH_OVERRIDES[META_QUESTION_TYPES.start] = 110;
CELLS_WIDTH_OVERRIDES[META_QUESTION_TYPES.end] = 110;
CELLS_WIDTH_OVERRIDES[ADDITIONAL_SUBMISSION_PROPS._id] = 100;
CELLS_WIDTH_OVERRIDES[QUESTION_TYPES.image.id] = 110;
CELLS_WIDTH_OVERRIDES[QUESTION_TYPES.audio.id] = 110;
CELLS_WIDTH_OVERRIDES[QUESTION_TYPES.video.id] = 110;
CELLS_WIDTH_OVERRIDES[META_QUESTION_TYPES['background-audio']] = 110;
Object.freeze(CELLS_WIDTH_OVERRIDES);

export const TEXT_FILTER_QUESTION_TYPES = [
  QUESTION_TYPES.text.id,
  QUESTION_TYPES.integer.id,
  QUESTION_TYPES.decimal.id,
  QUESTION_TYPES.date.id,
  QUESTION_TYPES.time.id,
  QUESTION_TYPES.datetime.id,
  QUESTION_TYPES.barcode.id,
  QUESTION_TYPES.calculate.id,
  META_QUESTION_TYPES.start,
  META_QUESTION_TYPES.end,
  META_QUESTION_TYPES.username,
  META_QUESTION_TYPES.deviceid,
  META_QUESTION_TYPES.phonenumber,
  META_QUESTION_TYPES.today,
  META_QUESTION_TYPES['background-audio'],
];

export const TEXT_FILTER_QUESTION_IDS = [
  '__version__',
  ADDITIONAL_SUBMISSION_PROPS._id,
  ADDITIONAL_SUBMISSION_PROPS._uuid,
  ADDITIONAL_SUBMISSION_PROPS._submission_time,
  ADDITIONAL_SUBMISSION_PROPS._submitted_by,
];
