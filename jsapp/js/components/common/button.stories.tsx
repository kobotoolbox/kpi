import React from 'react';
import type {ComponentStory, ComponentMeta} from '@storybook/react';
import {IconNames} from 'jsapp/fonts/k-icons';
import type {IconName} from 'jsapp/fonts/k-icons';
import type {MantineSize, PolymorphicComponentProps, TooltipProps} from '@mantine/core';
import Icon from './icon';
import '@mantine/core/styles.css';
import Button, {type ButtonProps} from './ButtonNew';

const buttonVariants: Array<ButtonProps['variant']> = [
  'filled',
  'light',
  // 'outline',
  // 'white',
  // 'subtle',
  // 'default',
  // 'gradient',

  //// Custom:
  'danger',
  'danger-secondary',

  'transparent',
];

const buttonSizes: MantineSize[] = [
  // 'xs',
  'sm',
  'md',
  'lg',
  // 'xl',
];

const tooltipPositions: Array<NonNullable<TooltipProps['position']>> = ['top', 'right', 'bottom', 'left', 'top-end', 'top-start', 'right-end', 'right-start', 'bottom-end', 'bottom-start', 'left-end', 'left-start'] as const;

export default {
  title: 'common/Button',
  component: Button,
  argTypes: {
    variant: {
      description: 'Variant of button',
      options: buttonVariants,
      control: 'select',
    },
    size: {
      description: 'Size of button',
      options: buttonSizes,
      control: 'radio',
    },
    leftSectionS: {
      description: 'Icon on the beginning',
      options: Object.keys(IconNames),
      mapping: Object.keys(IconNames).map((key) => [key, <Icon name={key as IconNames} size={'s'} />] as const).reduce((o, [k, v]) => {return {...o, [k]: v};}, {}),
      control: {type: 'select'},
      if: {arg: 'size', eq: 'sm'},
    },
    leftSectionM: {
      description: 'Icon on the beginning',
      options: Object.keys(IconNames),
      mapping: Object.keys(IconNames).map((key) => [key, <Icon name={key as IconNames} size={'m'} />] as const).reduce((o, [k, v]) => {return {...o, [k]: v};}, {}),
      control: {type: 'select'},
      if: {arg: 'size', eq: 'md'},
    },
    leftSectionL: {
      description: 'Icon on the beginning',
      options: Object.keys(IconNames),
      mapping: Object.keys(IconNames).map((key) => [key, <Icon name={key as IconNames} size={'l'} />] as const).reduce((o, [k, v]) => {return {...o, [k]: v};}, {}),
      control: {type: 'select'},
      if: {arg: 'size', eq: 'lg'},
    },
    rightSectionS: {
      description: 'Icon on the end',
      options: Object.keys(IconNames),
      mapping: Object.keys(IconNames).map((key) => [key, <Icon name={key as IconNames} size={'s'} />] as const).reduce((o, [k, v]) => {return {...o, [k]: v};}, {}),
      control: {type: 'select'},
      if: {arg: 'size', eq: 'sm'},
    },
    rightSectionM: {
      description: 'Icon on the end',
      options: Object.keys(IconNames),
      mapping: Object.keys(IconNames).map((key) => [key, <Icon name={key as IconNames} size={'m'} />] as const).reduce((o, [k, v]) => {return {...o, [k]: v};}, {}),
      control: {type: 'select'},
      if: {arg: 'size', eq: 'md'},
    },
    rightSectionL: {
      description: 'Icon on the end',
      options: Object.keys(IconNames),
      mapping: Object.keys(IconNames).map((key) => [key, <Icon name={key as IconNames} size={'l'} />] as const).reduce((o, [k, v]) => {return {...o, [k]: v};}, {}),
      control: {type: 'select'},
      if: {arg: 'size', eq: 'lg'},
    },
    tooltip: {
      description: 'Tooltip text',
      control: 'text',
    },
    tooltipProps: {
      description: 'Position of the tooltip (optional)',
      options: tooltipPositions,
      mapping: tooltipPositions.map((position) => [position, {position}] as const).reduce((o, [k, v]) => {return {...o, [k]: v};}, {}),
      control: 'radio',
    },
    disabled: {control: 'boolean'},
    loading: {control: 'boolean'},
    fullWidth: {
      description: 'Makes the button take 100% width of the container',
      control: 'boolean',
    },
  },
} as ComponentMeta<typeof Button>;

const Template: ComponentStory<typeof Button> = ({leftSectionS, leftSectionM, leftSectionL, rightSectionS, rightSectionM, rightSectionL, ...args}: any) =>
  <Button {...{...args, leftSection: leftSectionS ?? leftSectionM ?? leftSectionL, rightSection: rightSectionS ?? rightSectionM ?? rightSectionL}} />;

export const Primary = Template.bind({});
Primary.args = {
  variant: 'filled',
  size: 'lg',
  children: 'Click me',
};

export const Secondary = Template.bind({});
Secondary.args = {
  variant: 'light',
  size: 'lg',
  children: 'Click me',
};


export const Danger = Template.bind({});
Danger.args = {
  variant: 'danger',
  size: 'lg',
  children: 'Click me',
};

export const SecondaryDanger = Template.bind({});
SecondaryDanger.args = {
  variant: 'danger-secondary',
  size: 'lg',
  children: 'Click me',
};

export const Text = Template.bind({});
Text.args = {
  variant: 'transparent',
  size: 'lg',
  children: 'Click me',
};

const demoButtons: Array<{label?: string; leftSectionName?: IconName}> = [
  {
    label: 'Click me',
    leftSectionName: undefined,
  },
  {
    label: 'Click me',
    leftSectionName: 'document',
  },
  //// For button without text use ActionIcon instead!
  // {
  //   label: undefined,
  //   leftSectionName: 'document',
  // },
];

/**
 * We want to display a grid of all possible buttons:
 * - each type,
 * - in all sizes,
 * - with label x icon configurations,
 * - and in idle, pending, and disabled states.
 */
export const AllButtons = () => (
  <div style={{
    display: 'grid',
    gridTemplateColumns: 'repeat(6, auto)',
    gridAutoFlow: 'row',
    gridGap: '30px 15px',
    justifyItems: 'start',
    padding: '10px',
  }}>
    {buttonVariants.map((variant) => (
      buttonSizes.map((size) => (
        demoButtons.map(({label, leftSectionName}) => {
          const buttonProps: PolymorphicComponentProps<'button', ButtonProps> = {
            variant,
            size: size,
            leftSection: leftSectionName ? <Icon name={leftSectionName} size={size[0] as any} /> : undefined,
            onClick: () => console.info('Clicked!', variant, size, label, leftSectionName),
            tooltip: label,
          };
          return (
            <>
              <Button {...buttonProps}>{label}</Button>
              <Button {...buttonProps} loading>{label}</Button>
              <Button {...buttonProps} disabled>{label}</Button>
            </>
          );
        })
      ))
    ))}
  </div>
);
