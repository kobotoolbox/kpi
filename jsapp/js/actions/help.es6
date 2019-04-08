/**
 * help related actions
 */

import {dataInterface} from '../dataInterface';
import {
  t,
  notify
} from '../utils';
const Reflux = require('reflux');

const helpActions = Reflux.createActions({
  getInAppMessages: {
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

export default helpActions;
