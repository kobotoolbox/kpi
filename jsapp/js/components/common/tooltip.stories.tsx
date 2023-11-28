import React from 'react';
import type {Story, Meta} from '@storybook/react';

import type {TooltipProps} from './tooltip';
import Tooltip from './tooltip';

export default {
  title: 'Components/Tooltip',
  component: Tooltip,
} as Meta;

const Template: Story<typeof TooltipProps> = (args: typeof TooltipProps) => (
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
  className: 'right-tooltip',
  ariaLabel: 'Right Tooltip Text',
};

export const Left = Template.bind({});
Left.args = {
  text: 'Left Aligned Tooltip Text',
  className: 'left-tooltip',
  ariaLabel: 'Left Tooltip Text',
};
