import type {Meta, StoryObj} from '@storybook/react';
import TextInput, {TextInputProps} from './textInput';
import {IconNames} from 'jsapp/fonts/k-icons';

const inputSizes: Array<TextInputProps['size']> = [
  'sm',
  'md',
  'lg',
];

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
      defaultValue: 'md',
      options: inputSizes,
      control: {type: 'radio'},
    },
    leftIconName: {
      description: 'Appears inside the input, on the beginning.',
      options: Object.keys(IconNames),
      control: {type: 'select'},
    },
    rightIconName: {
      description:
        'Appears inside the input, on the end. Is replaced by "alert" icon if there are any errors.',
      options: Object.keys(IconNames),
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
  },
} as Meta<typeof TextInput>;

type Story = StoryObj<typeof TextInput>;

export const Primary: Story = {
  args: {
    label: 'Default Text Input',
    placeholder: 'Enter text...',
    size: 'md',
  },
};

export const AutoFocused: Story = {
  args: {
    label: 'Default Text Input',
    placeholder: 'Enter text...',
    size: 'md',
    autoFocus: true,
  },
};

export const Disabled: Story = {
  args: {
    label: 'Disabled Input',
    placeholder: 'You cannot type here',
    size: 'md',
    disabled: true,
  },
};

export const WithError: Story = {
  args: {
    label: 'Email',
    placeholder: 'Enter your email',
    value: "not an email",
    error: 'Invalid email address',
    size: 'md',
  },
};

export const WithIcon: Story = {
  args: {
    label: 'Required Input',
    placeholder: 'This field is required',
    required: true,
    withAsterisk: true,
    leftIconName: 'user',
    size: 'md',
  },
};
