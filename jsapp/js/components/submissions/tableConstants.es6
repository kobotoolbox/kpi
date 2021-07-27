import {
  createEnum,
  QUESTION_TYPES,
  META_QUESTION_TYPES,
} from 'js/constants';

// Columns that will be ALWAYS excluded from the view
export const EXCLUDED_COLUMNS = createEnum([
  '_xform_id_string',
  '_attachments',
  '_notes',
  '_bamboo_dataset_id',
  // '_status' is always 'submitted_via_web' unless submitted in bulk;
  // in that case, it's 'zip'
  '_status',
  'formhub/uuid',
  '_tags',
  '_geolocation',
  'meta/instanceID',
  'meta/deprecatedID',
  '_validation_status',
]);

export const SUBMISSION_ACTIONS_ID = '__SubmissionActions';

export const TABLE_MEDIA_TYPES = createEnum([
  QUESTION_TYPES.image.id,
  QUESTION_TYPES.audio.id,
  QUESTION_TYPES.video.id,
  META_QUESTION_TYPES['background-audio'],
]);

const tableConstants = {
  EXCLUDED_COLUMNS,
  SUBMISSION_ACTIONS_ID,
  TABLE_MEDIA_TYPES,
};

export default tableConstants;
