// eslint-disable-next-line no-restricted-imports -- Theme extensions must import Mantine primitives.
import { MultiSelect } from '@mantine/core'
import classes from './MultiSelect.module.css'

export const MultiSelectThemeKobo = MultiSelect.extend({
  classNames: classes,
  defaultProps: {
    // Keep default height aligned with Select when no explicit size is provided.
    size: 'md',
    withCheckIcon: false,
    comboboxProps: {
      offset: 0,
      dropdownPadding: 0,
      // needed in order to display correctly in a modal
      zIndex: 5000,
    },
  },
})
