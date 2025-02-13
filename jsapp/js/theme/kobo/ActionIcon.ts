import {rem, ActionIcon} from '@mantine/core';
import classes from './ActionIcon.module.css';

export const ActionIconThemeKobo = ActionIcon.extend({
  classNames: classes,
  vars: (theme, props) => {
    return {
      root: {
        '--ai-size-sm': rem(28),
        '--ai-size-md': rem(32),
        '--ai-size-lg': rem(38),

        ...(props.variant === 'filled' && {
          '--ai-hover': theme.colors.blue[5],
        }),
        ...(props.variant === 'light' && {
          '--ai-color': theme.colors.blue[4],
          '--ai-bg': theme.colors.blue[9],
          '--ai-hover': theme.colors.blue[8],
        }),
        ...(props.variant === 'transparent' && {
          '--ai-color': theme.colors.blue[4],
          '--ai-hover-color': theme.colors.blue[5],
        }),
        ...(props.variant === 'danger' && {
          '--ai-color': 'var(--mantine-color-white)',
          '--ai-bg': theme.colors.red[6],
          '--ai-hover': theme.colors.red[5],
        }),
        ...(props.variant === 'danger-secondary' && {
          '--ai-color': theme.colors.red[5],
          '--ai-bg': theme.colors.red[9],
          '--ai-hover': theme.colors.red[8],
        }),
      },
    };
  },
});
