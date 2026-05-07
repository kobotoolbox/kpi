import { Select } from '@mantine/core'
import classes from './Select.module.css'
import { KOBO_Z_INDEX } from './zIndex'

export const SelectThemeKobo = Select.extend({
  classNames: classes,
  defaultProps: {
    withCheckIcon: false,
    allowDeselect: false,
    comboboxProps: {
      offset: 0,
      dropdownPadding: 0,
      // needed in order to display correctly in a modal
      zIndex: KOBO_Z_INDEX.dropdown,
    },
  },
})
