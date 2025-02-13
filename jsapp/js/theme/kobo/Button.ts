import type {ButtonVariant} from '@mantine/core';
import {Button, rem} from '@mantine/core';
import classes from './Button.module.css';

type ButtonVariantCustom = Extract<ButtonVariant, 'filled' | 'light' | 'transparent'> | 'danger' | 'danger-secondary';

declare module '@mantine/core' {
  export interface ButtonProps {
    variant?: ButtonVariantCustom;
    // size?: ... // Can override ButtonFactory subset of ButtonProps only. TODO: Figure out how to forbid unused sizes.
  }
}

export const ButtonThemeKobo = Button.extend({
  classNames: classes,
  defaultProps: {
    variant: 'filled',
  },
  vars: (theme, props) => {
    return {
      root: {
        '--button-height-sm': rem(28),
        '--button-height-md': rem(32),
        '--button-height-lg': rem(38),
        '--button-padding-x-sm': rem(11.2),
        '--button-padding-x-md': rem(12.8),
        '--button-padding-x-lg': rem(15.2),
        '--button-bd': '0',

        // TODO: Consider standardizing global colors, or using them in a more standard way.
        ...(props.variant === 'filled' && {
          '--button-hover': theme.colors.blue[5],
        }),
        ...(props.variant === 'light' && {
          '--button-color': theme.colors.blue[5],
          '--button-bg': theme.colors.blue[9],
          '--button-hover': theme.colors.blue[8],
        }),
        ...(props.variant === 'transparent' && {
          '--button-color': theme.colors.blue[4],
          '--button-hover-color': theme.colors.blue[5],
        }),
        ...(props.variant === 'danger' && {
          '--button-color': 'var(--mantine-color-white)',
          '--button-bg': theme.colors.red[6],
          '--button-hover': theme.colors.red[5],
        }),
        ...(props.variant === 'danger-secondary' && {
          '--button-color': theme.colors.red[6],
          '--button-bg': theme.colors.red[9],
          '--button-hover': theme.colors.red[8],
        }),

      },
    };
  },

});
