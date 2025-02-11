import { Select } from '@mantine/core'

import classes from './Select.module.css'

export const SelectThemeKobo = Select.extend({
  classNames: classes,
  defaultProps: {
    withCheckIcon: false,
    allowDeselect: false,
    comboboxProps: {
      offset: 0,
      dropdownPadding: 0,
      // needed in order to display correctly in a modal
      zIndex: 5000,
    },
  },
})
