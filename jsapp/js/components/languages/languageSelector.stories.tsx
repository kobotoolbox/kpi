import type { Meta, StoryObj } from '@storybook/react'
import { http, HttpResponse } from 'msw'
import LanguageSelector from './languageSelector'
import { languagesResponsePage1st, languagesResponsePage2nd } from './languagesListStore.mock'

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
          } else {
            return HttpResponse.json(languagesResponsePage1st)
          }
        }),
      ],
    },
  },
}

export default meta

type Story = StoryObj<typeof LanguageSelector>

export const Primary: Story = {}
