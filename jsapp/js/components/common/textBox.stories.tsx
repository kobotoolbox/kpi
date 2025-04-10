import type { Meta, StoryObj } from '@storybook/react'
import { IconNames } from '#/k-icons'
import TextBox from './textBox'
import type { TextBoxSize, TextBoxType } from './textBox'

const textBoxTypes: TextBoxType[] = ['email', 'number', 'password', 'text-multiline', 'text', 'url']
const textBoxSizes: TextBoxSize[] = ['s', 'm', 'l']

const meta: Meta<typeof TextBox> = {
  title: 'Design system old/TextBox',
  component: TextBox,
  argTypes: {
    type: {
      description: 'Type of the HTML `input`, choosing "text-multiline" will render a `textarea`.',
      defaultValue: { summary: 'text' },
      options: textBoxTypes,
      control: 'select',
    },
    size: {
      description: 'Changes the size of the component (similar sizing as Button)',
      defaultValue: { summary: 'l' },
      options: textBoxSizes,
      control: 'radio',
    },
    startIcon: {
      description: 'Appears inside the input, on the beginning.',
      options: Object.keys(IconNames),
      control: 'select',
    },
    endIcon: {
      description: 'Appears inside the input, on the end. Is replaced by "alert" icon if there are any errors.',
      options: Object.keys(IconNames),
      control: 'select',
    },
    value: { control: 'text' },
    errors: {
      description: 'Displays errors underneath the input and changes the component color to red.',
      options: [undefined, true, 'This is the only error', ['This is first error', 'This is second error']],
      control: {
        type: 'radio',
        labels: {
          undefined: 'No error',
          true: 'Error without message (boolean)',
          'This is the only error': 'One error (string)',
          // Note: we need to provide literal array-to-string conversion here,
          // can't simply use the output.
          [String(['This is first error', 'This is second error'])]: 'Multiple errors (array of strings)',
        },
      },
    },
    label: {
      control: 'text',
      description: 'Appears above the input. Required for the "required" mark to appear',
    },
    placeholder: { control: 'text' },
    readOnly: { control: 'boolean' },
    disabled: { control: 'boolean' },
    required: { control: 'boolean' },
    onChange: { description: 'Input value change callback' },
    onBlur: { description: 'Input blur callback' },
    onKeyPress: { description: 'Input typing callback' },
    className: {
      description: 'Adds custom class name to topmost wrapper',
    },
    'data-cy': { description: 'Cypress identifier' },
  },
  parameters: {
    docs: {
      description: {
        component: 'This is a component that displays an input. It uses most of the browser built-in functionalities.',
      },
    },
  },
}

export default meta

type Story = StoryObj<typeof TextBox>

export const Primary: Story = {
  args: {
    label: 'Your real name',
    placeholder: 'Type your name...',
  },
}

export const Disabled: Story = {
  args: {
    label: "You can't remove this value",
    value: "I'm here to stay!",
    disabled: true,
  },
}

export const WithErrors: Story = {
  args: {
    label: 'Well done.',
    placeholder: "We weren't even testing for that",
    errors: ['Horrible person', "I'm serious, that's what it says: 'A horrible person.'"],
  },
}

export const WithIcon: Story = {
  args: {
    label: 'Your nice and funny username',
    placeholder: 'It really needs to be funny, sorry!',
    required: true,
    startIcon: 'user',
  },
}
