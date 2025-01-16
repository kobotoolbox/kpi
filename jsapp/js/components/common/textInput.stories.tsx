import type {ComponentStory, ComponentMeta} from '@storybook/react';
import {TextInput} from './textInput';
import {IconNames} from 'jsapp/fonts/k-icons';
import Icon from './icon';

export default {
  title: 'common/TextInput',
  component: TextInput,
  argTypes: {
    label: {
      description: 'Appears above the input',
      control: 'text',
    },
    placeholder: {
      description: 'Placeholder text for the input',
      control: 'text',
      type: 'string',
    },
    value: {
      description: 'Current value of the input',
      control: 'text',
    },
    onChange: {
      description: 'Input value change callback',
    },
    size: {
      description:
        'Changes the size of the component (similar sizing as Button)',
      defaultValue: {summary: 'lg'},
      options: ['sm', 'md', 'lg'],
      control: {type: 'radio'},
    },
    leftSection: {
      description: 'Appears inside the input, on the beginning.',
      options: Object.keys(IconNames),
      mapping: Object.keys(IconNames)
        .map(
          (key) =>
            [key, <Icon name={key as IconNames} color='storm' />] as const
        )
        .reduce((o, [k, v]) => {
          return {...o, [k]: v};
        }, {}),
      control: {type: 'select'},
    },
    rightSection: {
      description:
        'Appears inside the input, on the end. Is replaced by "alert" icon if there are any errors.',
      options: Object.keys(IconNames),
      mapping: Object.keys(IconNames)
        .map(
          (key) =>
            [key, <Icon name={key as IconNames} color='storm' />] as const
        )
        .reduce((o, [k, v]) => {
          return {...o, [k]: v};
        }, {}),
      control: {type: 'select'},
    },
    disabled: {
      description: 'Disables the input',
      control: 'boolean',
    },
    required: {
      description: 'Marks the input as required',
      control: 'boolean',
    },
    error: {
      description: 'Error message or state for the input',
      control: 'text',
    },
    withAsterisk: {
      description: 'Displays an asterisk if the input is required',
      control: 'boolean',
    },
  },
} as ComponentMeta<typeof TextInput>;

const Template: ComponentStory<typeof TextInput> = (args) => (
  <TextInput {...args} />
);

export const Primary = Template.bind({});
Primary.args = {
  label: 'Default Text Input',
  placeholder: 'Enter text...',
  size: 'md',
};

export const Disabled = Template.bind({});
Disabled.args = {
  label: 'Disabled Input',
  placeholder: 'You cannot type here',
  size: 'md',
  disabled: true,
};

export const WithError = Template.bind({});
WithError.args = {
  label: 'Email',
  placeholder: 'Enter your email',
  error: 'Invalid email address',
  size: 'md',
};

export const WithIcon = Template.bind({});
WithIcon.args = {
  label: 'Required Input',
  placeholder: 'This field is required',
  required: true,
  withAsterisk: true,
  leftSection: <Icon name='user' color='storm' />,
  size: 'md',
};
