import type {Meta, StoryObj} from '@storybook/react';
import { TextInput, TextInputProps } from '@mantine/core';
import Icon from './icon';

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

export const WithIconLeft: Story = {
  args: {
    label: 'Required Input',
    placeholder: 'This field is required',
    required: true,
    withAsterisk: true,
    leftSection: <Icon name='user' size='s' />,
    size: 'md',
  },
};

export const WithIconRight: Story = {
  args: {
    label: 'Required Input',
    placeholder: 'This field is required',
    required: true,
    withAsterisk: true,
    rightSection: <Icon name='user' size='s' />,
    size: 'md',
  },
};
