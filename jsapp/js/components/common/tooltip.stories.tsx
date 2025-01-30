import React from 'react';
import type {Meta, Story} from '@storybook/react';

import type {TooltipProps, TooltipAlignment} from './tooltip';
import Tooltip from './tooltip';

const tooltipPositions: TooltipAlignment[] = ['right', 'left', 'center'];

export default {
  title: 'Common/Tooltip',
  component: Tooltip,
  description:
    'This is a component that displays a tooltip on a button that is hovered over.',
  argTypes: {
    text: {
      description: 'Content of the tooltip shown on hover over button',
      control: 'text',
    },
    alignment: {
      description:
        'Position of the tooltip (centered as default)',
      options: tooltipPositions,
      control: 'radio',
    },
    ariaLabel: {
      description: 'Accessible label for screen readers',
    },
  },
} as Meta;

const Template: Story<TooltipProps> = (args) => (
  <Tooltip {...args}>
    <button>Your Button</button>
  </Tooltip>
);

export const Default = Template.bind({});
Default.args = {
  text: 'Default Tooltip Text',
  alignment: 'center',
  ariaLabel: 'Default Tooltip Text',
};

export const Right = Template.bind({});
Right.args = {
  text: 'Right Aligned Tooltip Text',
  alignment: 'right',
  ariaLabel: 'Right Aligned Tooltip Text',
};

export const Left = Template.bind({});
Left.args = {
  text: 'Left Aligned Tooltip Text',
  alignment: 'left',
  ariaLabel: 'Left Aligned Tooltip Text',
};
