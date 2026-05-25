// eslint-disable-next-line no-restricted-imports -- Theme extensions must import Mantine primitives.
import { Select } from '@mantine/core'
import classes from './Select.module.css'
import baseClasses from './SelectBase.module.css'

export const SelectThemeKobo = Select.extend({
  classNames: {
    ...baseClasses,
    input: [baseClasses.input, classes.input].filter(Boolean).join(' '),
  },
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
