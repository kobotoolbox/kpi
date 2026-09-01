import type { Decorator } from '@storybook/react'
import type { Meta, StoryObj } from '@storybook/react-webpack5'
import { http, HttpResponse } from 'msw'
import { fn } from 'storybook/test'
import environmentMock from '#/endpoints/environment.mocks'
import { queryClientDecorator } from '#/query/queryClient.mocks'
import StandaloneUILanguageSelector from './index'

const onLanguageChanged = fn()
const onLanguageRequested = fn()

function setLanguageHandler(status = 204) {
  return http.post('*/i18n/setlang/', async ({ request }) => {
    onLanguageRequested(new URLSearchParams(await request.text()).get('language'))
    return new HttpResponse(null, { status })
  })
}

/** Light background */
const KOBO_BACKGROUND = 'linear-gradient(135deg, #f3f6f9, #dfe9f0)'

/** Dark "custom" background */
const CUSTOM_BACKGROUND = 'linear-gradient(135deg, #4a5c66, #16232a)'

/**
 * Places the selector in top right corner, allows setting custom background
 */
const withPageFrame: Decorator = (Story, context) => {
  const { background = KOBO_BACKGROUND, width = undefined } = context.parameters.pageFrame ?? {}

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'flex-start',
        minHeight: 360,
        width,
        padding: 16,
        background,
      }}
    >
      {Story()}
    </div>
  )
}

const meta: Meta<typeof StandaloneUILanguageSelector> = {
  title: 'Components/StandaloneUILanguageSelector',
  component: StandaloneUILanguageSelector,
  args: {
    // Also keeps the component from reloading the Storybook iframe, which is what it does by default.
    onLanguageChanged,
  },
  decorators: [queryClientDecorator, withPageFrame],
  parameters: {
    msw: { handlers: [setLanguageHandler(), environmentMock] },
    a11y: { disable: true },
  },
}

export default meta

type Story = StoryObj<typeof StandaloneUILanguageSelector>

/** The toggle only has room for the current language as a two letter abbreviation. */
export const Default: Story = {}

/** Over an admin-uploaded background photo, where the toggle needs the light-on-dark treatment. */
export const OnCustomBackground: Story = {
  args: { hasCustomBackground: true },
  parameters: { pageFrame: { background: CUSTOM_BACKGROUND } },
}
