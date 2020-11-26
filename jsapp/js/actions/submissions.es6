/**
 * submissions related actions
 */

import Reflux from 'reflux';
import {dataInterface} from '../dataInterface';
import {notify} from 'utils';

const submissionsActions = Reflux.createActions({
  bulkDeleteStatus: {children: ['completed', 'failed']},
  bulkPatch: {children: ['completed', 'failed']},
  bulkDelete: {children: ['completed', 'failed']},
});

submissionsActions.bulkDeleteStatus.listen(() => {
  dataInterface.bulkDeleteStatus()
    .done(submissionsActions.bulkDeleteStatus.completed)
    .fail(submissionsActions.bulkDeleteStatus.failed);
});
submissionsActions.bulkDeleteStatus.failed.listen(() => {
  notify(t('Failed to update submissions.'), 'error');
});

submissionsActions.bulkPatch.listen(() => {
  dataInterface.bulkPatch()
    .done(submissionsActions.bulkPatch.completed)
    .fail(submissionsActions.bulkPatch.failed);
});
submissionsActions.bulkPatch.failed.listen(() => {
  notify(t('Failed to update submissions.'), 'error');
});

submissionsActions.bulkDelete.listen(() => {
  dataInterface.bulkDelete()
    .done(submissionsActions.bulkDelete.completed)
    .fail(submissionsActions.bulkDelete.failed);
});
submissionsActions.bulkDelete.failed.listen(() => {
  notify(t('Failed to delete submissions.'), 'error');
});

export default submissionsActions;
