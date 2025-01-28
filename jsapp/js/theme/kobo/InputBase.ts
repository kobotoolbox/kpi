import classes from './InputBase.module.css';
import {InputBase} from '@mantine/core';

export const InputBaseThemeKobo = InputBase.extend({
  defaultProps: {
    size: 'sm',
    wrapperProps: {
      classNames: {
        label: classes.label,
      },
    },
    classNames: {
      input: classes.input,
      section: classes.section,
    },
  },
});
