import type { Meta, StoryObj } from '@storybook/react-webpack5'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import languageDetailMock from '#/endpoints/languageDetail.mocks'
import { queryClientDecorator } from '#/query/queryClient.mocks'
import RegionSelectorInline from './RegionSelectorInline'

const meta: Meta<typeof RegionSelectorInline> = {
  title: 'Components/RegionSelectorInline',
  component: RegionSelectorInline,
  argTypes: {
    rootLanguage: { control: 'text' },
    disabled: { control: 'boolean' },
    serviceCode: { control: 'text' },
    serviceType: {
      control: 'radio',
      options: ['transcription', 'translation'],
    },
  },
  decorators: [queryClientDecorator],
  parameters: {
    msw: {
      handlers: [languageDetailMock],
    },
    a11y: { test: 'todo' },
  },
}

export default meta

type Story = StoryObj<typeof RegionSelectorInline>

export const Primary: Story = {
  args: {
    rootLanguage: 'en',
    disabled: false,
    serviceCode: 'goog',
    serviceType: 'transcription',
    onRegionChange: (selectedRegion) => {
      console.log('Region changed:', selectedRegion)
    },
    onCancel: () => {
      console.log('Cancelled')
    },
  },
}
// Tests complete RegionSelectorInline workflow: loading, region selection, sorting, callbacks, and cancel
export const InteractionTest: Story = {
  args: {
    rootLanguage: 'en',
    disabled: false,
    serviceCode: 'goog',
    serviceType: 'transcription',
    onRegionChange: fn(),
    onCancel: fn(),
  },
  play: async ({ canvasElement, args, step }) => {
    const canvas = within(canvasElement)
    const user = userEvent.setup()

    await step('Wait for language data to load', async () => {
      await waitFor(
        async () => {
          const languageInput = canvas.getByDisplayValue('English')
          expect(languageInput).toBeInTheDocument()
          expect(languageInput).toHaveAttribute('readonly')
          expect(languageInput).toHaveValue('English')
        },
        { timeout: 3000 },
      )
    })

    await step('Verify cancel button is present and enabled', async () => {
      const cancelButton = canvas.getByRole('button', { name: 'Close' })
      expect(cancelButton).toBeInTheDocument()
      expect(cancelButton).not.toBeDisabled()
    })

    await step('Wait for region select to appear', async () => {
      await waitFor(
        async () => {
          // Mantine Select renders as an input, try multiple selectors
          const regionSelect = canvas.getByPlaceholderText('Select a region...')
          expect(regionSelect).toBeInTheDocument()
        },
        { timeout: 3000 },
      )
    })

    await step('Verify initial region is auto-selected', async () => {
      await waitFor(
        async () => {
          expect(args.onRegionChange).toHaveBeenCalled()
        },
        { timeout: 3000 },
      )
      // onRegionChange first sends null before the data loads, we need to get the most recent post-load call with -1
      const firstCall = (args.onRegionChange as ReturnType<typeof fn>).mock.calls.at(-1)!
      expect(firstCall[0]).toBeTruthy()
    })

    await step('Open region dropdown and verify options', async () => {
      const regionSelect = canvas.getByPlaceholderText('Select a region...')
      await user.click(regionSelect)

      await waitFor(async () => {
        const options = document.querySelectorAll('[role="option"]')
        expect(options.length).toBeGreaterThan(0)
        expect(options.length).toBe(2)

        // Verify alphabetical sorting
        const optionTexts = Array.from(options).map((option) => option.textContent)
        expect(optionTexts).toEqual(['United Kingdom', 'United States'])
      })
    })

    await step('Select a different region', async () => {
      const options = document.querySelectorAll('[role="option"]')
      const unitedStatesOption = Array.from(options).find((option) => option.textContent === 'United States')
      expect(unitedStatesOption).toBeInTheDocument()
      await user.click(unitedStatesOption!)

      // Verify correct option
      const calls = (args.onRegionChange as ReturnType<typeof fn>).mock.calls
      const lastCall = calls[calls.length - 1]
      expect(lastCall[0]).toBe('en-US')
    })

    await step('Verify the select shows the selected value', async () => {
      await waitFor(() => {
        const selectInput = canvas.getByPlaceholderText('Select a region...')
        expect(selectInput).toHaveValue('United States')
      })
    })

    await step('Test cancel button functionality', async () => {
      const cancelButton = canvas.getByRole('button', { name: 'Close' })
      await user.click(cancelButton)

      await waitFor(() => {
        expect(args.onCancel).toHaveBeenCalledTimes(1)
      })
    })
  },
}
