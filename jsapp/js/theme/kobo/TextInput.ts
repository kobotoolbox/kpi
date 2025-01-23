import {TextInput} from '@mantine/core';
import classes from './Input.module.css';

export const TextInputThemeKobo = TextInput.extend({
  classNames: classes,
  defaultProps: {
    size: 'sm',
  },
});
