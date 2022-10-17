/**
 * submissions related actions
 */

import Reflux from 'reflux';
import {dataInterface} from 'js/dataInterface';
import {notify} from 'utils';
import {ROOT_URL} from 'js/constants';

const submissionsActions = Reflux.createActions({
  getSubmission: {children: ['completed', 'failed']},
  getSubmissionByUuid: {children: ['completed', 'failed']},
  getSubmissions: {children: ['completed', 'failed']},
  bulkDeleteStatus: {children: ['completed', 'failed']},
  bulkPatchStatus: {children: ['completed', 'failed']},
  bulkPatchValues: {children: ['completed', 'failed']},
  bulkDelete: {children: ['completed', 'failed']},
  getProcessingSubmissions: {children: ['completed', 'failed']},
});

/**
 * @typedef SortObj
 * @param {string} id - column name
 * @param {boolean} desc - `true` for descending and `false` for ascending
 */

/**
 * NOTE: all of the parameters have their default values defined for
 * `dataInterface` function.
 *
 * @param {object} options
 * @param {string} options.uid - the asset uid
 * @param {number} [options.pageSize]
 * @param {number} [options.page]
 * @param {SortObj[]} [options.sort]
 * @param {string[]} [options.fields]
 * @param {string} [options.filter]
 */
submissionsActions.getSubmissions.listen((options) => {
  dataInterface.getSubmissions(
    options.uid,
    options.pageSize,
    options.page,
    options.sort,
    options.fields,
    options.filter
  )
    .done((response) => {
      submissionsActions.getSubmissions.completed(response, options);
    })
    .fail((response) => {
      submissionsActions.getSubmissions.failed(response, options);
    });
});

/**
 * This gets an array of submission uuids
 * @param {string} assetUid
 */
submissionsActions.getProcessingSubmissions.listen((assetUid, questionsPaths) => {
  let fields = '';
  questionsPaths.forEach((questionPath) => {
    fields += `,"${questionPath}"`;
  });

  $.ajax({
    dataType: 'json',
    method: 'GET',
    url: `${ROOT_URL}/api/v2/assets/${assetUid}/data/?sort={"_submission_time":-1}&fields=["_uuid", "meta/rootUuid" ${fields}]`,
  })
    .done(submissionsActions.getProcessingSubmissions.completed)
    .fail(submissionsActions.getProcessingSubmissions.failed);
});
submissionsActions.getProcessingSubmissions.failed.listen(() => {
  notify(t('Failed to get submissions uuids.'), 'error');
});

submissionsActions.getSubmission.listen((assetUid, submissionId) => {
  dataInterface.getSubmission(assetUid, submissionId)
    .done(submissionsActions.getSubmission.completed)
    .fail(submissionsActions.getSubmission.failed);
});

// There is no shortcut endpoint to get submission using uuid, so we have to
// make a queried call over all submissions.
submissionsActions.getSubmissionByUuid.listen((assetUid, submissionUuid) => {
  // `_uuid` is the legacy identifier that changes (per OpenRosa spec) after every edit;
  // `meta/rootUuid` remains consistent across edits.
  let query = {
    '$or': [
      {'meta/rootUuid': submissionUuid},
      {'_uuid': submissionUuid},
    ],
  };
  query = JSON.stringify(query);
  $.ajax({
    dataType: 'json',
    method: 'GET',
    url: `${ROOT_URL}/api/v2/assets/${assetUid}/data/?query=${query}`,
  })
    .done((response) => {
      // preferentially return a result matching the persistent UUID
      let result;
      const preferred = response.results.filter(
        (e) => e['meta/rootUuid'] === submissionUuid
      );
      if (preferred.length > 0) {
        result = preferred[0];
      } else {
        result = response.results[0];
      }
      submissionsActions.getSubmissionByUuid.completed(result);
    })
    .fail(submissionsActions.getSubmissionByUuid.failed);
});
submissionsActions.getSubmissionByUuid.failed.listen(() => {
  notify(t('Failed to get submission.'), 'error');
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
