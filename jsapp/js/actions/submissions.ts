/**
 * submissions related actions
 */

import Reflux from 'reflux'
import { dataInterface } from '#/dataInterface'
import type {
  BulkSubmissionsRequest,
  FailResponse,
  GetSubmissionsOptions,
  PaginatedResponse,
  SubmissionResponse,
} from '#/dataInterface'
import { notify } from '#/utils'

/**
 * @deprecated migrate to react-query whenever you need to adjust things beyond simple rename
 */
const submissionsActions = Reflux.createActions({
  getSubmissions: { children: ['completed', 'failed'] },
  bulkDeleteStatus: { children: ['completed', 'failed'] },
  bulkPatchStatus: { children: ['completed', 'failed'] },
  bulkPatchValues: { children: ['completed', 'failed'] },
  bulkDelete: { children: ['completed', 'failed'] },
})

/**
 * NOTE: all of the parameters have their default values defined for
 * `dataInterface` function.
 */
submissionsActions.getSubmissions.listen((options: GetSubmissionsOptions) => {
  dataInterface
    .getSubmissions(options.uid, options.pageSize, options.page, options.sort, options.fields, options.filter)
    .done((response: PaginatedResponse<SubmissionResponse>) => {
      submissionsActions.getSubmissions.completed(response, options)
    })
    .fail((response: FailResponse) => {
      submissionsActions.getSubmissions.failed(response, options)
    })
})

submissionsActions.bulkDeleteStatus.listen((uid: string, data: BulkSubmissionsRequest) => {
  dataInterface
    .bulkRemoveSubmissionsValidationStatus(uid, data)
    .done(submissionsActions.bulkDeleteStatus.completed)
    .fail(submissionsActions.bulkDeleteStatus.failed)
})
submissionsActions.bulkDeleteStatus.failed.listen(() => {
  notify(t('Failed to update submissions.'), 'error')
})

submissionsActions.bulkPatchStatus.listen((uid: string, data: BulkSubmissionsRequest) => {
  dataInterface
    .bulkPatchSubmissionsValidationStatus(uid, data)
    .done(submissionsActions.bulkPatchStatus.completed)
    .fail(submissionsActions.bulkPatchStatus.failed)
})
submissionsActions.bulkPatchStatus.failed.listen(() => {
  notify(t('Failed to update submissions.'), 'error')
})

/**
 * @param {string} uid - project unique id
 * @param {string[]} submissionIds - selected submissions
 * @param {object} data
 * @param {string} data.<field_name_to_update> - with a new value, repeat with different fields if necessary
 */
submissionsActions.bulkPatchValues.listen((uid: string, submissionIds: string[], data: BulkSubmissionsRequest) => {
  dataInterface
    .bulkPatchSubmissionsValues(uid, submissionIds, data)
    .done(submissionsActions.bulkPatchValues.completed)
    .fail(submissionsActions.bulkPatchValues.failed)
})
submissionsActions.bulkPatchValues.completed.listen((response: { failures: number }) => {
  if (response.failures !== 0) {
    notify(t('Failed to update some submissions values.'), 'error')
  }
})
submissionsActions.bulkPatchValues.failed.listen(() => {
  notify(t('Failed to update submissions values.'), 'error')
})

submissionsActions.bulkDelete.listen((uid: string, data: BulkSubmissionsRequest) => {
  dataInterface
    .bulkDeleteSubmissions(uid, data)
    .done(() => {
      notify(t('submissions deleted'))
      submissionsActions.bulkDelete.completed()
    })
    .fail(() => {
      notify.error(t('failed to delete submissions'))
      submissionsActions.bulkDelete.failed()
    })
})
submissionsActions.bulkDelete.failed.listen(() => {
  notify(t('Failed to delete submissions.'), 'error')
})

export default submissionsActions
