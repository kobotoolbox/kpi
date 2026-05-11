import type { Meta, StoryObj } from '@storybook/react-webpack5'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fn } from 'storybook/test'
import environmentMock from '#/endpoints/environment.mocks'
import languagesMock from '#/endpoints/languages.mocks'
import LanguageSelector from '../languages/languageSelector'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
})

const meta: Meta<typeof LanguageSelector> = {
  title: 'Components/LanguageSelector',
  component: LanguageSelector,
  decorators: [
    (Story) => (
      <QueryClientProvider client={queryClient}>
        <Story />
      </QueryClientProvider>
    ),
  ],
  argTypes: {
    required: {
      description: 'A red asterisk after the label',
      control: { type: 'boolean' },
    },
    titleOverride: {
      description: 'Displayed label',
      control: { type: 'text' },
    },
    suggestedLanguages: {
      description: 'List of languages in the "Suggested" group. Must be in the format of a LanguageCode array.',
      control: { type: 'object' },
    },
    hiddenLanguages: {
      description: 'List of languages that will be hidden. Must be in the format of a LanguageCode array.',
      control: { type: 'object' },
    },
  },
  parameters: {
    msw: {
      handlers: [languagesMock, environmentMock],
    },
    a11y: { test: 'todo' },
  },
}

export default meta

type Story = StoryObj<typeof LanguageSelector>

export const Default: Story = {
  args: {
    onLanguageChange: fn(),
    required: true,
    titleOverride: 'Select a language',
    suggestedLanguages: ['ar', 'bn'],
    hiddenLanguages: ['', ''],
  },
}
