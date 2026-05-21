import type { Meta, StoryObj } from '@storybook/react-webpack5'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import languageDetailMock from '#/endpoints/languageDetail.mocks'
import { queryClientDecorator } from '#/query/queryClient.mocks'
import RegionSelector from './RegionSelector'

const meta: Meta<typeof RegionSelector> = {
  title: 'Components/RegionSelector',
  component: RegionSelector,
  argTypes: {
    rootLanguage: { control: 'text' },
    isDisabled: { control: 'boolean' },
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

type Story = StoryObj<typeof RegionSelector>

export const Primary: Story = {
  args: {
    rootLanguage: 'en',
    isDisabled: false,
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
// Tests complete RegionSelector workflow: loading, region selection, sorting, callbacks, and cancel
export const InteractionTest: Story = {
  args: {
    rootLanguage: 'en',
    isDisabled: false,
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
        },
        { timeout: 3000 },
      )
    })

    await step('Verify language input properties', async () => {
      const languageInput = canvas.getByDisplayValue('English')
      expect(languageInput).toHaveAttribute('readonly')
      expect(languageInput).toHaveValue('English')

      const languageIcon = languageInput.parentElement?.querySelector('svg')
      expect(languageIcon).toBeInTheDocument()
    })

    await step('Verify cancel button is present and enabled', async () => {
      const cancelButton = canvas.getByRole('button', { name: '' })
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
      const firstCall = (args.onRegionChange as ReturnType<typeof fn>).mock.calls[0]
      expect(firstCall[0]).toBeTruthy()
    })

    await step('Open region dropdown and verify options', async () => {
      const regionSelect = canvas.getByPlaceholderText('Select a region...')
      await user.click(regionSelect)

      await waitFor(async () => {
        const options = document.querySelectorAll('[role="option"]')
        expect(options.length).toBeGreaterThan(0)
      })
    })

    //
    await step('Verify region options are sorted alphabetically', async () => {
      const options = document.querySelectorAll('[role="option"]')
      expect(options.length).toBe(2)

      const optionTexts = Array.from(options).map((option) => option.textContent)
      expect(optionTexts).toEqual(['United Kingdom', 'United States'])
    })

    await step('Select a different region', async () => {
      const options = document.querySelectorAll('[role="option"]')
      const unitedStatesOption = Array.from(options).find((option) => option.textContent === 'United States')
      expect(unitedStatesOption).toBeInTheDocument()
      await user.click(unitedStatesOption!)
    })

    await step('Verify onRegionChange callback is called with correct value', async () => {
      await waitFor(() => {
        const calls = (args.onRegionChange as ReturnType<typeof fn>).mock.calls
        const lastCall = calls[calls.length - 1]
        expect(lastCall[0]).toBe('en-US')
      })
    })

    await step('Verify the select shows the selected value', async () => {
      await waitFor(() => {
        const selectInput = canvas.getByPlaceholderText('Select a region...')
        expect(selectInput).toHaveValue('United States')
      })
    })

    await step('Test cancel button functionality', async () => {
      const cancelButton = canvas.getByRole('button', { name: '' })
      await user.click(cancelButton)

      await waitFor(() => {
        expect(args.onCancel).toHaveBeenCalledTimes(1)
      })
    })
  },
}
