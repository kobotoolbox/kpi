/**
 * For some custom dropdown handling
 */

import Reflux from 'reflux';

const koboDropdownActions = Reflux.createActions({
  hideAnyDropdown: {children: ['requested']},
});

/**
 * Use this action to close dropdowns from any place in the code.
 */
koboDropdownActions.hideAnyDropdown.listen(
  koboDropdownActions.hideAnyDropdown.requested
);

export default koboDropdownActions;
