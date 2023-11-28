import React from 'react';
import type {Meta, Story} from '@storybook/react';

import type {TooltipProps} from './tooltip';
import Tooltip from './tooltip';

export default {
  title: 'Common/Tooltip',
  component: Tooltip,
} as Meta;

// Correctly importing TooltipProps as a type
const Template: Story<TooltipProps> = (args) => (
  <Tooltip {...args}>
    <button>Your Button</button>
  </Tooltip>
);

export const Default = Template.bind({});
Default.args = {
  text: 'Default Tooltip Text',
  className: '',
  ariaLabel: 'Default Tooltip Text',
};

export const Right = Template.bind({});
Right.args = {
  text: 'Right Aligned Tooltip Text',
  className: 'right',
  ariaLabel: 'Right Aligned Tooltip Text',
};

export const Left = Template.bind({});
Left.args = {
  text: 'Left Aligned Tooltip Text',
  className: 'left',
  ariaLabel: 'Left Aligned Tooltip Text',
};
