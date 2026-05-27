import { MultiSelect } from '@mantine/core'
import classes from './MultiSelect.module.css'
import { KOBO_Z_INDEX } from './zIndex'

export const MultiSelectThemeKobo = MultiSelect.extend({
  classNames: classes,
  defaultProps: {
    withCheckIcon: false,
    comboboxProps: {
      offset: 0,
      dropdownPadding: 0,
      // needed in order to display correctly in a modal
      zIndex: KOBO_Z_INDEX.dropdown,
    },
  },
})
