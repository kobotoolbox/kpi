import React from 'react';
import {Select} from '@mantine/core';

import classes from './Select.module.css';
import Icon from 'jsapp/js/components/common/icon';

export const SelectThemeKobo = Select.extend({
  classNames: classes,
  defaultProps: {
    withCheckIcon: false,
    rightSection: <Icon name='caret-down' size='xxs' />,
    comboboxProps: {
      offset: 0,
    },
  },
});
