/**
 * For some custom dropdown handling
 */

import Reflux from 'reflux';

const koboDropdownActions = Reflux.createActions({
  hideAnyDropdown: {children: ['requested']},
  menuVisibilityChange: {children: ['done']}
});

/** Use this action to close dropdowns from any place in the code. */
koboDropdownActions.hideAnyDropdown.listen(
  koboDropdownActions.hideAnyDropdown.requested
);

/** Use this action to know when dropdown menu was opened or closed. */
koboDropdownActions.menuVisibilityChange.listen((
  name: string,
  isVisible: boolean
) => {
  koboDropdownActions.menuVisibilityChange.done(name, isVisible)
});

export default koboDropdownActions;
