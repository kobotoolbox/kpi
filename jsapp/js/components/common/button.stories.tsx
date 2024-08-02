import React from 'react';
import type {ComponentStory, ComponentMeta} from '@storybook/react';
import Button from './button';
import type {ButtonType, ButtonSize} from './button';
import type {TooltipAlignment} from './tooltip';
import {IconNames} from 'jsapp/fonts/k-icons';

const buttonTypes: ButtonType[] = ['primary', 'secondary', 'danger', 'secondary-danger', 'text'];

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
  type: 'primary',
  size: 'l',
  label: 'click me',
};
