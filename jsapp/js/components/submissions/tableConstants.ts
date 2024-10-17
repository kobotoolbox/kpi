import {
  createEnum,
  META_QUESTION_TYPES,
  ADDITIONAL_SUBMISSION_PROPS,
  QuestionTypeName,
  MiscRowTypeName,
} from 'js/constants';
import type {AnyRowTypeName} from 'js/constants';

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
  'meta/rootUuid',
  'meta/instanceID',
  'meta/deprecatedID',
  '_validation_status',
];

export enum SortValues {
  ASCENDING = 'ASCENDING',
  DESCENDING = 'DESCENDING',
}

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
  QuestionTypeName.image,
  QuestionTypeName.audio,
  QuestionTypeName.video,
  QuestionTypeName['background-audio'],
]);

export const DEFAULT_DATA_CELL_WIDTH = 140;

export const CELLS_WIDTH_OVERRIDES: {[key: string]: number} = {};
CELLS_WIDTH_OVERRIDES[VALIDATION_STATUS_ID_PROP] = 125;
CELLS_WIDTH_OVERRIDES[META_QUESTION_TYPES.start] = 110;
CELLS_WIDTH_OVERRIDES[META_QUESTION_TYPES.end] = 110;
CELLS_WIDTH_OVERRIDES[ADDITIONAL_SUBMISSION_PROPS._id] = 100;
CELLS_WIDTH_OVERRIDES[QuestionTypeName.image] = 110;
CELLS_WIDTH_OVERRIDES[QuestionTypeName.audio] = 170;
CELLS_WIDTH_OVERRIDES[QuestionTypeName.video] = 110;
CELLS_WIDTH_OVERRIDES[QuestionTypeName['background-audio']] = 170;
Object.freeze(CELLS_WIDTH_OVERRIDES);

/**
 * For these question types the UI will display a dropdown filter in Data Table
 * for the matching column.
 */
export const DROPDOWN_FILTER_QUESTION_TYPES: AnyRowTypeName[] = [
  QuestionTypeName.select_multiple,
  QuestionTypeName.select_one,
];

/**
 * For these question types the UI will display a text filter in Data Table for
 * the matching column.
 */
export const TEXT_FILTER_QUESTION_TYPES: AnyRowTypeName[] = [
  QuestionTypeName.barcode,
  QuestionTypeName.calculate,
  QuestionTypeName.date,
  QuestionTypeName.datetime,
  QuestionTypeName.decimal,
  QuestionTypeName.integer,
  QuestionTypeName.range,
  QuestionTypeName.rank,
  QuestionTypeName.score,
  // TODO: for now there is no code in `table.es6` that makes the choices from
  // file available there, so we fallback to text filter
  QuestionTypeName.select_multiple_from_file,
  QuestionTypeName.select_one_from_file,
  // ENDTODO
  QuestionTypeName.text,
  QuestionTypeName.time,
  META_QUESTION_TYPES.start,
  META_QUESTION_TYPES.end,
  META_QUESTION_TYPES.username,
  META_QUESTION_TYPES.deviceid,
  META_QUESTION_TYPES.phonenumber,
  META_QUESTION_TYPES.today,
  MiscRowTypeName.score__row,
  MiscRowTypeName.rank__level,
];

/**
 * For these question ids the UI will display a text filter in Data Table for
 * the matching column. We need this, because these are additional submission
 * properties, so they don't have a question type attached to them.
 */
export const TEXT_FILTER_QUESTION_IDS = [
  '__version__',
  ADDITIONAL_SUBMISSION_PROPS._id,
  ADDITIONAL_SUBMISSION_PROPS._uuid,
  ADDITIONAL_SUBMISSION_PROPS._submission_time,
  ADDITIONAL_SUBMISSION_PROPS._submitted_by,
];

/**
 * These are question types that will be filtered by the exact filter value
 * (i.e. filter value is exactly the response). Any question type not on this
 * list will be filtered by responses that include the value (i.e. filter value
 * is part of the response).
 *
 * Every type that is not listed here is using "inexact" or "partial" match.
 */
export const FILTER_EXACT_TYPES: AnyRowTypeName[] = [
  QuestionTypeName.decimal,
  QuestionTypeName.integer,
  QuestionTypeName.range,
  QuestionTypeName.rank,
  QuestionTypeName.score,
  QuestionTypeName.select_one,
  QuestionTypeName.select_one_from_file,
];
