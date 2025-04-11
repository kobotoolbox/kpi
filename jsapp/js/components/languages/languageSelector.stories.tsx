import type { Meta, StoryObj } from '@storybook/react'
import { expect, userEvent, within } from '@storybook/test'
import { http, HttpResponse } from 'msw'
import { environmentResponse } from '#/envStore.mock'
import LanguageSelector from './languageSelector'
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

type Story = StoryObj<typeof LanguageSelector>

export const Primary: Story = {}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export const TestSearchSwedish: Story = {
  play: async ({ canvasElement }) => {
    // TODO: wait for languagesStore to be ready?
    await sleep(2000)

    const canvas = within(canvasElement)
    const input = await canvas.findByRole('textbox')
    await userEvent.type(input, 'swed')

    // TODO: wait for langaugesStore to get response from API
    await sleep(2000)

    const element = await canvas.findByText(/^Swedish/)
    await expect(element).toBeInTheDocument()
  },
}
