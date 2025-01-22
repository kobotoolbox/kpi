import {InputWrapper} from '@mantine/core';

export const InputWrapperThemeKobo = InputWrapper.extend({
  vars: (theme) => {
    return {
      label: {
        '--input-label-size': theme.fontSizes.xs,
        color: theme.colors.gray[1],
        marginBottom: '5px',
      },
      error: {},
      description: {},
    };
  },
});
