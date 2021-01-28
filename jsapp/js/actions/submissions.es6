/**
 * submissions related actions
 */

import Reflux from 'reflux';
import {dataInterface} from 'js/dataInterface';
import {notify} from 'utils';

const submissionsActions = Reflux.createActions({
  bulkDeleteStatus: {children: ['completed', 'failed']},
  bulkPatchStatus: {children: ['completed', 'failed']},
  bulkPatchValues: {children: ['completed', 'failed']},
  bulkDelete: {children: ['completed', 'failed']},
});

submissionsActions.bulkDeleteStatus.listen((uid, data) => {
  dataInterface.bulkRemoveSubmissionsValidationStatus(uid, data)
    .done(submissionsActions.bulkDeleteStatus.completed)
    .fail(submissionsActions.bulkDeleteStatus.failed);
});
submissionsActions.bulkDeleteStatus.failed.listen(() => {
  notify(t('Failed to update submissions.'), 'error');
});

submissionsActions.bulkPatchStatus.listen((uid, data) => {
  dataInterface.bulkPatchSubmissionsValidationStatus(uid, data)
    .done(submissionsActions.bulkPatchStatus.completed)
    .fail(submissionsActions.bulkPatchStatus.failed);
});
submissionsActions.bulkPatchStatus.failed.listen(() => {
  notify(t('Failed to update submissions.'), 'error');
});

/**
 * @param {string} uid - project unique id
 * @param {string[]} submissionIds - selected submissions
 * @param {object} data
 * @param {string} data.<field_name_to_update> - with a new value, repeat with different fields if necessary
 */
submissionsActions.bulkPatchValues.listen((uid, submissionIds, data) => {
  dataInterface.bulkPatchSubmissionsValues(uid, submissionIds, data)
    .done(submissionsActions.bulkPatchValues.completed)
    .fail(submissionsActions.bulkPatchValues.failed);
});
submissionsActions.bulkPatchValues.completed.listen((response) => {
  if (response.failures !== 0) {
    notify(t('Failed to update some submissions values.'), 'error');
  }
});
submissionsActions.bulkPatchValues.failed.listen(() => {
  notify(t('Failed to update submissions values.'), 'error');
});

submissionsActions.bulkDelete.listen((uid, data) => {
  dataInterface.bulkDeleteSubmissions(uid, data)
    .done(submissionsActions.bulkDelete.completed)
    .fail(submissionsActions.bulkDelete.failed);
});
submissionsActions.bulkDelete.failed.listen(() => {
  notify(t('Failed to delete submissions.'), 'error');
});

export default submissionsActions;
