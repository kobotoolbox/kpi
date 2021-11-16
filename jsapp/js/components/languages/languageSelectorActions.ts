/** For some custom language selector handling */

import Reflux from 'reflux';

const languageSelectorActions = Reflux.createActions({
  resetAll: {children: ['requested']},
});

/** Use this action to reset all language selecetors selected language. */
languageSelectorActions.resetAll.listen(
  languageSelectorActions.resetAll.requested
);

export default languageSelectorActions;
