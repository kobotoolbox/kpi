import {Input} from '@mantine/core';
import classes from './Input.module.css';

export const InputThemeKobo = Input.extend({
  classNames: classes,
  defaultProps: {
    size: 'sm',
  },
  vars: (theme, props) => {
    return {
      wrapper: {
        '--input-fz': theme.fontSizes.md,
      },
      input: {
        '--input-bd': theme.colors.gray[6],
        '--input-disabled-bg': theme.colors.gray[7],
        '--input-placeholder-color': theme.colors.gray[3],
        ...(props.disabled && {
          '--input-bd': theme.colors.gray[3],
          '--input-placeholder-color': theme.colors.gray[2],
        }),
        ...(props.error && {
          '--input-bd': theme.colors.red[7],
        }),
      },
      section: {
        '--input-section-color': theme.colors.gray[2],
        ...(props.disabled && {
          '--input-section-color': theme.colors.gray[5],
        }),
        ...(props.error && {
          '--input-section-color': theme.colors.red[7],
        }),
      },
    };
  },
});
