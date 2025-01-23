import {TextInput} from '@mantine/core';
import type {Meta, StoryObj} from '@storybook/react';
import {useArgs} from '@storybook/preview-api';
import type {TextInputProps} from './textInput';
import Icon from './icon';
import ActionIcon from './ActionIcon';
import type {ChangeEvent} from 'react';
import {useState} from 'react';

const inputSizes: Array<TextInputProps['size']> = ['sm', 'md', 'lg'];

const Render = ({...args}: TextInputProps) => {
  const [, updateArgs] = useArgs();

  return (
    <TextInput
      {...args}
      onChange={(e: ChangeEvent<HTMLInputElement>) =>
        updateArgs({value: e.target.value})
      }
    />
  );
};

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
    // leftIconName: {
    //   description: 'Appears inside the input, on the beginning.',
    //   options: Object.keys(IconNames),
    //   control: {type: 'select'},
    // },
    // rightIconName: {
    //   description:
    //     'Appears inside the input, on the end. Is replaced by "alert" icon if there are any errors.',
    //   options: Object.keys(IconNames),
    //   control: {type: 'select'},
    // },
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
  args: {
    value: undefined,
  },
} as Meta<typeof TextInput>;

type Story = StoryObj<typeof TextInput>;

export const Primary: Story = {
  render: Render,
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
    value: 'not an email',
    error: 'Invalid email address',
    size: 'md',
  },
};

export const WithLeftSection = () => {
  const args = {
    label: 'Username',
    placeholder: 'Type your username',
    size: 'md',
    leftSection: <Icon name='user' size='s' />,
  };

  return <TextInput {...args} />;
};

export const WithRightSection = () => {
  const [value, setValue] = useState('');

  const args = {
    label: 'Click on the action icon to generate a number',
    placeholder: 'Type some value',
    size: 'md',
    rightSection: (
      <ActionIcon
        size='sm'
        iconName='replace'
        onClick={() => setValue(Math.floor(Math.random() * 9999).toString())}
      />
    ),
  };

  return (
    <TextInput
      {...args}
      value={value}
      onChange={(e: ChangeEvent<HTMLInputElement>) => setValue(e.target.value)}
    />
  );
};
