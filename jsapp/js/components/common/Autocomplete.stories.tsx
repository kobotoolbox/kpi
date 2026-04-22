import type { Meta, StoryObj } from '@storybook/react-webpack5'
import Autocomplete from './Autocomplete'

const meta: Meta<typeof Autocomplete> = {
  title: 'Design system/Autocomplete',
  component: Autocomplete,
  argTypes: {
    label: {
      description: 'Displayed label',
      control: { type: 'text' },
    },
		withAsterisk: {
			description: 'A red asterisk after the label',
			control: { type: 'boolean'}
		},
    data: {
      description: 'List of data to be displayed',
      control: {type: 'object'}
    }
  },
  parameters: { a11y: { test: 'todo' } },
}

export default meta

type Story = StoryObj<typeof Autocomplete>

export const Default: Story = {
  args: {
    label: 'Select a language',
    placeholder: 'Type or select a language',
    withAsterisk: true,
    data: ['English (en)', 'French (fr)', 'Afrikaans (af)', 'Amharic (am)', 'Arabic (ar)'],
  }
}
