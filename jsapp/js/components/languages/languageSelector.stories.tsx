import type { Meta, StoryObj } from '@storybook/react'
import { expect, fn, userEvent, within } from '@storybook/test'
import { http, HttpResponse } from 'msw'
import { environmentResponse } from '#/envStore.mock'
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

export const Primary: Story = {}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export const TestSearchSwedish: Story = {
  args: {
    onLanguageChange: fn(),
  },
  play: async ({ args, canvasElement }) => {
    // Wait for languages list to be ready
    await sleep(2000)

    // Type "swed" to find "Swedish" language
    const canvas = within(canvasElement)
    const searchInput = await canvas.findByRole('searchbox')
    await userEvent.type(searchInput, 'swed')

    // Wait for search response to be ready
    await sleep(2000)

    // Verify that the "Swedish" language is present in the list
    const searchResultItem = await canvas.findByText(/^Swedish/)
    await expect(searchResultItem).toBeInTheDocument()

    // Click the result
    await userEvent.click(searchResultItem)

    // Search result should be cleared, and the selected language should be "Swedish"
    await expect(searchResultItem).not.toBeInTheDocument()
    const selectedLanguage = await canvas.findByText(/^Swedish/)
    await expect(selectedLanguage).toBeInTheDocument()
    // Verify that the onLanguageChange callback have been called (i.e. parent component is informed which language
    // was selected)
    await expect((args as StoryArgs).onLanguageChange).toHaveBeenCalledTimes(1)
  },
}
