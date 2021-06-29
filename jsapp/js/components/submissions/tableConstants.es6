import {createEnum} from 'js/constants';

export const SUBMISSION_ACTIONS_ID = '__SubmissionActions';

export const VALIDATION_STATUS_ID_PROP = '_validation_status.uid';

// Columns that will be ALWAYS excluded from the view
export const EXCLUDED_COLUMNS = [
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
];

export const SORT_VALUES = createEnum([
  'A_TO_Z',
  'Z_TO_A',
]);
