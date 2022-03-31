/**
 * help related actions
 */

import Reflux from 'reflux';
import {dataInterface} from '../dataInterface';
import {notify} from 'utils';

export const helpActions = Reflux.createActions({
  getInAppMessages: {
    children: [
      'completed',
      'failed'
    ]
  },
  setMessageAcknowledged: {
    children: [
      'completed',
      'failed'
    ]
  },
  setMessageReadTime: {
    children: [
      'completed',
      'failed'
    ]
  }
});

helpActions.getInAppMessages.listen(() => {
  dataInterface.getHelpInAppMessages()
    .done(helpActions.getInAppMessages.completed)
    .fail(helpActions.getInAppMessages.failed);
});
helpActions.getInAppMessages.failed.listen(() => {
  notify(t('Failed to get in app messages.'), 'error');
});

helpActions.setMessageReadTime.listen((uid, readTime) => {
  dataInterface.patchHelpInAppMessage(uid, {interactions: {
    readTime: readTime,
    // we assume that reading messages is a conscious action
    acknowledged: true
  }})
    .done(helpActions.setMessageReadTime.completed)
    .fail(helpActions.setMessageReadTime.failed);
});
helpActions.setMessageReadTime.failed.listen(() => {
  notify(t('Failed to set message readTime.'), 'error');
});

helpActions.setMessageAcknowledged.listen((uid, isAcknowledged) => {
  dataInterface.patchHelpInAppMessage(uid, {interactions: {acknowledged: isAcknowledged}})
    .done(helpActions.setMessageAcknowledged.completed)
    .fail(helpActions.setMessageAcknowledged.failed);
});
helpActions.setMessageAcknowledged.failed.listen(() => {
  notify(t('Failed to set message acknowledged.'), 'error');
});
