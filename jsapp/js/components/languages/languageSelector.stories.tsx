import type { Meta, StoryObj } from '@storybook/react'
import { expect, fn, userEvent, within } from '@storybook/test'
import { http, HttpResponse } from 'msw'
import { environmentResponse } from '#/envStore.mock'
import { sleep } from '#/storybookUtils'
import LanguageSelector, { type LanguageSelectorProps } from './languageSelector'
import {
  languagesResponsePage1st,
  languagesResponsePage2nd,
  languagesResponseQuerySwed,
} from './languagesListStore.mock'

const meta: Meta<typeof LanguageSelector> = {
  title: 'Components/LanguageSelector',
  component: LanguageSelector,
  argTypes: {},
  parameters: {
    msw: {
      handlers: [
        http.get('/api/v2/languages/', (info) => {
          if (info.request.url.endsWith('limit=100&offset=100')) {
            return HttpResponse.json(languagesResponsePage2nd)
          } else if (info.request.url.endsWith('q=swed')) {
            return HttpResponse.json(languagesResponseQuerySwed)
          } else {
            return HttpResponse.json(languagesResponsePage1st)
          }
        }),
        http.get('/environment/', () => HttpResponse.json(environmentResponse)),
      ],
    },
  },
}

export default meta
type StoryArgs = LanguageSelectorProps
type Story = StoryObj<typeof LanguageSelector> & { args?: StoryArgs }

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

    await step(
      'Wait for languages list to be ready and verify that the "Arabic" language is present in the initial list.',
      async () => {
        await sleep(2000)
        const noSearchItem = await canvas.findByText(/^Arabic/)
        await expect(noSearchItem).toBeInTheDocument()
      },
    )

    let searchResultItem: HTMLElement
    await step(
      'Type "swed" to find "Swedish" language. Wait for API response and verify that the language is present in the list.',
      async () => {
        const searchInput = await canvas.findByRole('searchbox')
        await userEvent.type(searchInput, 'swed')
        await sleep(2000)
        searchResultItem = await canvas.findByText(/^Swedish/)
        await expect(searchResultItem).toBeInTheDocument()
      },
    )

    let selectedLanguage: HTMLElement
    await step(
      'Click the result to select the language. Search result should be cleared, and the selected language should be displayed.',
      async () => {
        await userEvent.click(searchResultItem)
        await expect(searchResultItem).not.toBeInTheDocument()
        selectedLanguage = await canvas.findByText(/^Swedish/)
        await expect(selectedLanguage).toBeInTheDocument()
        // Verify that the onLanguageChange callback have been called (i.e. parent component is informed which language
        // was selected)
        await expect((args as StoryArgs).onLanguageChange).toHaveBeenCalledTimes(1)
      },
    )

    await sleep(2000)

    await step(
      'Clear selected result and then clear search input. Wait for response and verify that the initial list is being displayed again.',
      async () => {
        const clearSelectedLanguageButton = await canvas.findByTitle('Clear selected language')
        await userEvent.click(clearSelectedLanguageButton)
        await expect(selectedLanguage).not.toBeInTheDocument()
        const clearSearchButton = await canvas.findByTitle('Clear search')
        await userEvent.click(clearSearchButton)
        await sleep(2000)
        const noSearchItem2 = await canvas.findByText(/^Arabic/)
        await expect(noSearchItem2).toBeInTheDocument()
      },
    )
  },
}
