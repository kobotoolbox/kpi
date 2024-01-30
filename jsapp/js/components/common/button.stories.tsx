import React from 'react';
import type {ComponentStory, ComponentMeta} from '@storybook/react';
import Button from './button';
import type {ButtonType, ButtonColor, ButtonSize} from './button';
import type {TooltipAlignment} from './tooltip';
import {IconNames} from 'jsapp/fonts/k-icons';

const buttonTypes: ButtonType[] = ['bare', 'frame', 'full'];

const buttonColors: ButtonColor[] = [
  'blue',
  'light-blue',
  'red',
  'storm',
  'cloud',
  'dark-red',
  'dark-blue',
];

const buttonSizes: ButtonSize[] = ['s', 'm', 'l'];

const tooltipPositions: TooltipAlignment[] = ['right', 'left', 'center'];

export default {
  title: 'common/Button',
  component: Button,
  argTypes: {
    type: {
      description: 'Type of button',
      options: buttonTypes,
      control: 'select',
    },
    color: {
      description: 'Color of button',
      options: buttonColors,
      control: 'select',
    },
    size: {
      description: 'Size of button',
      options: buttonSizes,
      control: 'radio',
    },
    startIcon: {
      description: 'Icon on the beginning (please use only one of the icons)',
      options: Object.keys(IconNames),
      control: {type: 'select'},
    },
    endIcon: {
      description: 'Icon on the end (please use only one of the icons)',
      options: Object.keys(IconNames),
      control: {type: 'select'},
    },
    label: {
      control: 'text',
    },
    tooltip: {
      description: 'Tooltip text',
      control: 'text',
    },
    tooltipPosition: {
      description: 'Position of the tooltip (optional)',
      options: tooltipPositions,
      control: 'radio',
    },
    isDisabled: {control: 'boolean'},
    isPending: {control: 'boolean'},
    isFullWidth: {
      description: 'Makes the button take 100% width of the container',
      control: 'boolean',
    },
  },
} as ComponentMeta<typeof Button>;

const Template: ComponentStory<typeof Button> = (args) => <Button {...args} />;

export const Primary = Template.bind({});
Primary.args = {
  type: 'full',
  color: 'blue',
  size: 'l',
  label: 'click me',
};
