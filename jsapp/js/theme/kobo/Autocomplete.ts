// eslint-disable-next-line no-restricted-imports -- Theme extender must import Mantine primitive directly.
import { Autocomplete } from '@mantine/core'
import classes from './Autocomplete.module.css'

export const AutocompleteThemeKobo = Autocomplete.extend({
  classNames: classes,
})
