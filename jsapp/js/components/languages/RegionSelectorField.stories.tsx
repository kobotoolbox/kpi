import type { Meta, StoryObj } from '@storybook/react-webpack5'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import languageDetailMock from '#/endpoints/languageDetail.mocks'
import { queryClientDecorator } from '#/query/queryClient.mocks'
import RegionSelectorField from './RegionSelectorField'

const meta: Meta<typeof RegionSelectorField> = {
  title: 'Components/RegionSelectorField',
  component: RegionSelectorField,
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

type Story = StoryObj<typeof RegionSelectorField>

export const Primary: Story = {
  args: {
    rootLanguage: 'en',
    disabled: false,
    serviceCode: 'goog',
    serviceType: 'transcription',
    onRegionChange: (selectedRegion) => {
      console.log('Region changed:', selectedRegion)
    },
    onCancel: () => {},
  },
}
// Tests RegionSelectorField: loading, region selection, sorting, and callbacks
export const InteractionTest: Story = {
  args: {
    rootLanguage: 'en',
    disabled: false,
    serviceCode: 'goog',
    serviceType: 'transcription',
    onRegionChange: fn(),
    onCancel: () => {},
  },
  play: async ({ canvasElement, args, step }) => {
    const canvas = within(canvasElement)
    const user = userEvent.setup()

    await step('Wait for region select to appear', async () => {
      await waitFor(
        async () => {
          const regionSelect = canvas.getByPlaceholderText('Select a region...')
          expect(regionSelect).toBeInTheDocument()
        },
        { timeout: 3000 },
      )
    })

    await step('Verify initial region is auto-selected', async () => {
      await waitFor(
        async () => {
          // Wait for onRegionChange to be called with a truthy value (after data loads)
          const calls = (args.onRegionChange as ReturnType<typeof fn>).mock.calls
          const lastCall = calls.at(-1)
          expect(lastCall).toBeDefined()
          expect(lastCall![0]).toBeTruthy()
        },
        { timeout: 3000 },
      )
    })

    await step('Open region dropdown and verify options are sorted alphabetically', async () => {
      const regionSelect = canvas.getByPlaceholderText('Select a region...')
      await user.click(regionSelect)

      await waitFor(async () => {
        const options = document.querySelectorAll('[role="option"]')
        expect(options.length).toBe(2)

        // Verify alphabetical sorting
        const optionTexts = Array.from(options).map((option) => option.textContent)
        expect(optionTexts).toEqual(['United Kingdom', 'United States'])
      })
    })

    await step('Select a different region and verify callback', async () => {
      const options = document.querySelectorAll('[role="option"]')
      const unitedStatesOption = Array.from(options).find((option) => option.textContent === 'United States')
      expect(unitedStatesOption).toBeInTheDocument()
      await user.click(unitedStatesOption!)

      // Verify onRegionChange called with correct value
      const calls = (args.onRegionChange as ReturnType<typeof fn>).mock.calls
      const lastCall = calls[calls.length - 1]
      expect(lastCall[0]).toBe('en-US')
    })

    await step('Verify the select displays the selected value', async () => {
      await waitFor(() => {
        const selectInput = canvas.getByPlaceholderText('Select a region...')
        expect(selectInput).toHaveValue('United States')
      })
    })
  },
}
