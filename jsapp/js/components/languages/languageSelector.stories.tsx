import type { Meta, StoryObj } from '@storybook/react'
import { expect, fn, userEvent, waitFor, within } from '@storybook/test'
import environmentMock from '#/endpoints/environment.mock'
import languagesMock from '#/endpoints/languages.mock'
import LanguageSelector from './languageSelector'

const meta: Meta<typeof LanguageSelector> = {
  title: 'Components/LanguageSelector',
  component: LanguageSelector,
  argTypes: {},
  parameters: {
    msw: {
      handlers: [languagesMock, environmentMock],
    },
  },
}

export default meta
type Story = StoryObj<typeof LanguageSelector>

export const Default: Story = {}

/**
 * This test is searching for "Swedish" language, selecting it, and then undoing both the selection and the search.
 */
export const TestSearchAndSelection: Story = {
  args: {
    onLanguageChange: fn(),
  },
  play: async ({ args, canvasElement, step }) => {
    const canvas = within(canvasElement)

    await step('Verify that the Arabic language is present in the initial list', async () => {
      await waitFor(async () => {
        const noSearchItem = await canvas.findByText(/^Arabic/)
        await expect(noSearchItem).toBeInTheDocument()
      })
    })

    let searchResultItem: HTMLElement
    await step('Type "swed" to find Swedish language - verify it is present in the search results', async () => {
      const searchInput = await canvas.findByRole('searchbox')
      await userEvent.type(searchInput, 'swed')
      await waitFor(async () => {
        searchResultItem = await canvas.findByText(/^Swedish/)
        await expect(searchResultItem).toBeInTheDocument()
      })
    })

    let selectedLanguage: HTMLElement
    await step('Select the Swedish language by clicking on it', async () => {
      await userEvent.click(searchResultItem)
      await step('The `onLanguageChange` should be called with {code: "sv"}', async () => {
        await expect(args.onLanguageChange).toHaveBeenCalledWith(expect.objectContaining({ code: 'sv' }))
      })
      await step('The search result should be cleared', async () => {
        await expect(searchResultItem).not.toBeInTheDocument()
      })
      await step('The selected language should be displayed', async () => {
        selectedLanguage = await canvas.findByTitle('Selected language')
        await expect(selectedLanguage).toBeInTheDocument()
      })
    })

    await step('Clear selected language', async () => {
      await step('Selected language should be cleared', async () => {
        const clearSelectedLanguageButton = await canvas.findByTitle('Clear selected language')
        await userEvent.click(clearSelectedLanguageButton)
        await expect(selectedLanguage).not.toBeInTheDocument()
      })
      await step('Previous search results should be visible', async () => {
        searchResultItem = await canvas.findByText(/^Swedish/)
        await expect(searchResultItem).toBeInTheDocument()
      })
    })

    await step('Clear search input to see initial list', async () => {
      const clearSearchButton = await canvas.findByTitle('Clear search')
      await userEvent.click(clearSearchButton)
      await waitFor(async () => {
        const noSearchItem2 = await canvas.findByText(/^Arabic/)
        await expect(noSearchItem2).toBeInTheDocument()
      })
    })
  },
}
