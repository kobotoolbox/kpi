import {TextInput} from '@mantine/core';
import classes from './TextInput.module.css';

export const TextInputThemeKobo = TextInput.extend({
  classNames: classes,
  defaultProps: {
    placeholder: 'Enter text',
    size: 'sm',
    radius: 'md',
  },
});
