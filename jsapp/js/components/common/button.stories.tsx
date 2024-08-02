import React from 'react';
import type {ComponentStory, ComponentMeta} from '@storybook/react';
import Button from './button';
import type {ButtonType, ButtonSize, ButtonProps} from './button';
import type {TooltipAlignment} from './tooltip';
import {IconNames} from 'jsapp/fonts/k-icons';
import type {IconName} from 'jsapp/fonts/k-icons';

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
  label: 'Click me',
};

export const Secondary = Template.bind({});
Secondary.args = {
  type: 'secondary',
  size: 'l',
  label: 'Click me',
};


export const Danger = Template.bind({});
Danger.args = {
  type: 'danger',
  size: 'l',
  label: 'Click me',
};

export const SecondaryDanger = Template.bind({});
SecondaryDanger.args = {
  type: 'secondary-danger',
  size: 'l',
  label: 'Click me',
};

export const Text = Template.bind({});
Text.args = {
  type: 'text',
  size: 'l',
  label: 'Click me',
};

const demoButtons: Array<{label?: string, startIcon?: IconName}> = [
  {
    label: 'Click me',
    startIcon: undefined,
  },
  {
    label: 'Click me',
    startIcon: 'document',
  },
  {
    label: undefined,
    startIcon: 'document',
  }
];

export const AllButtons = () => (
  <div style={{display: 'flex', flexDirection: 'column', gap: '20px', margin: '20px'}}>
    {buttonTypes.map((buttonType) => (
      buttonSizes.map((buttonSize) => (
        <div style={{display: 'flex', flexDirection: 'row', gap: '10px'}}>
          {demoButtons.map((demoButton) => {
            const buttonProps: ButtonProps = {
              type: buttonType,
              size: buttonSize,
              onClick: () => alert('Clicked!'),
            };
            if (demoButton.label) {
              buttonProps.label = demoButton.label;
            }
            if (demoButton.startIcon) {
              buttonProps.startIcon = demoButton.startIcon;
            }
            return (
              <div style={{display: 'flex', flexWrap: 'wrap', gap: '10px'}}>
                <Button {...buttonProps}/>
                <Button {...buttonProps} isPending/>
                <Button {...buttonProps} isDisabled/>
              </div>
            );
          })}
        </div>
      ))
    ))}
  </div>
);
