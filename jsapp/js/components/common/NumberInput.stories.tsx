import { NumberInput, type NumberInputProps } from '@mantine/core'
import type { Meta, StoryObj } from '@storybook/react-webpack5'

const inputSizes: Array<NumberInputProps['size']> = ['sm', 'md', 'lg']

const meta: Meta<typeof NumberInput> = {
  title: 'Design system/NumberInput',
  component: NumberInput,
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
      control: 'number',
    },
    size: {
      description: 'Changes the size of the component',
      defaultValue: 'md',
      options: inputSizes,
      control: { type: 'radio' },
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
  args: {
    label: 'Number input',
    placeholder: 'Enter a number',
    size: 'md',
    min: 0,
    step: 1,
  },
}

export default meta

type Story = StoryObj<typeof NumberInput>

export const Primary: Story = {}

export const Disabled: Story = {
  args: {
    disabled: true,
    value: 42,
  },
}

export const WithError: Story = {
  args: {
    value: 42,
    error: 'Enter a value between 0 and 100',
  },
}
