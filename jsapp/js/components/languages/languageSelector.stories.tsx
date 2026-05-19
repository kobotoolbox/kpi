import type { Meta, StoryObj } from '@storybook/react-webpack5'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import environmentMock from '#/endpoints/environment.mocks'
import languagesMock from '#/endpoints/languages.mocks'
import LanguageSelector from '../languages/LanguageSelector'

const SELECT_LABEL = 'Select a language'
const CLEAR_BUTTON_SELECTOR = 'button.language-selector-clear-button'

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
    titleOverride: SELECT_LABEL,
    suggestedLanguages: ['ar', 'bn'],
    hiddenLanguages: ['', ''],
  },
}

export const InteractionTest: Story = {
  args: {
    onLanguageChange: fn(),
    required: true,
    titleOverride: SELECT_LABEL,
    suggestedLanguages: ['ar', 'bn'],
    hiddenLanguages: ['', ''],
  },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement)
    // Mantine renders dropdown options in a portal attached to document.body.
    const page = within(canvasElement.ownerDocument.body)

    // Role exposure differs across Mantine versions and modes.
    // Prefer label, then combobox, then textbox fallback to keep this test stable.
    const findLanguageInput = async () => {
      const byLabel = canvas.queryByLabelText(SELECT_LABEL)
      if (byLabel) {
        return byLabel
      }

      const byCombobox = canvas.queryByRole('combobox')
      if (byCombobox) {
        return byCombobox
      }

      return canvas.findByRole('textbox')
    }

    const findClearButton = () => canvasElement.querySelector(CLEAR_BUTTON_SELECTOR)

    await step('Open selector and search for adangme', async () => {
      const input = await findLanguageInput()
      await userEvent.click(input)
      await userEvent.type(input, 'ada')

      await expect(await page.findByText('Adangme (ada)')).toBeInTheDocument()
    })

    await step('Select Adangme and verify selected value', async () => {
      await userEvent.click(await page.findByText('Adangme (ada)'))

      await waitFor(async () => {
        const input = await findLanguageInput()
        await expect(input).toHaveValue('Adangme (ada)')
      })
    })

    await step('Clear selection and verify nothing is selected', async () => {
      // Clear control is aria-hidden, so role queries cannot find it.
      // LanguageSelector adds a dedicated class to keep this assertion reliable.
      await waitFor(() => {
        const clearButton = findClearButton()
        expect(clearButton).toBeInTheDocument()
      })
      const clearButton = findClearButton()
      if (!clearButton) {
        throw new Error('Language selector clear button not found')
      }
      await userEvent.click(clearButton)

      await waitFor(async () => {
        const input = await findLanguageInput()
        await expect(input).toHaveValue('')
      })
    })

    await step('Search swd and verify not-found message', async () => {
      const input = await findLanguageInput()
      await userEvent.click(input)
      await userEvent.type(input, 'swd')

      await expect(
        await page.findByText('No matching languages found. Try another spelling or language name'),
      ).toBeInTheDocument()
    })

    await step('Search swed and select Swedish', async () => {
      const input = await findLanguageInput()
      await userEvent.clear(input)
      // "swed" phrase is supported by the mock
      await userEvent.type(input, 'swed')

      await expect(await page.findByText('Swedish (sv)')).toBeInTheDocument()
      await userEvent.click(await page.findByText('Swedish (sv)'))

      await waitFor(async () => {
        const selectedInput = await findLanguageInput()
        await expect(selectedInput).toHaveValue('Swedish (sv)')
      })
    })
  },
}
