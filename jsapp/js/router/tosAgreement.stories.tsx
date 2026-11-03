import type { Meta, StoryObj } from '@storybook/react-webpack5'
import { http, HttpResponse, delay } from 'msw'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { getApiV2TermsOfServiceListMockHandler } from '#/api/react-query/other/msw'
import { queryClientDecorator } from '#/query/queryClient.mocks'
import TOSAgreement from './tosAgreement.component'

/**
 * The TOS blocker, frame included. It covers the terms only - profile details have their own blocker, see
 * `ProfileDetailsScreen.stories`.
 */

// A minimal announcement so the form gets past its loading guard. Without a message whose slug is
// `terms_of_service` the form would spin forever.
const termsOfServiceMock = getApiV2TermsOfServiceListMockHandler([
  {
    url: 'http://kf.kobo.local/api/v2/terms-of-service/terms_of_service/',
    slug: 'terms_of_service',
    body: '<h1>Terms of Service</h1>\n<p>Please accept our Terms of Service.</p>\n<ul>\n<li>First change</li>\n<li>Second change</li>\n</ul>',
  },
])

/**
 * Accepting reloads the page, which in a story would reload the Storybook iframe. A POST that never
 * answers gets us the pending state without the navigation.
 */
const acceptNeverAnswersMock = () =>
  http.post('*/me/tos{/}?', async () => {
    await delay('infinite')
  })

/** Accepting rejected, which leaves the buttons usable so it can be tried again. */
const acceptServerErrorMock = () =>
  http.post('*/me/tos{/}?', () => HttpResponse.json({ detail: 'Internal server error.' }, { status: 500 }))

const meta: Meta<typeof TOSAgreement> = {
  title: 'Features/TOSAgreement',
  component: TOSAgreement,
  // Docs view can't render a full page frame usefully
  tags: ['!autodocs'],
  parameters: {
    layout: 'fullscreen',
    msw: { handlers: [termsOfServiceMock] },
    a11y: { disable: true },
  },
  decorators: [queryClientDecorator],
}

export default meta
type Story = StoryObj<typeof TOSAgreement>

const AGREE_LABEL = "I agree, let's go"
const DECLINE_LABEL = "I don't agree, log me out"

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await canvas.findByRole('button', { name: AGREE_LABEL })
    expect(canvas.getByText('Please accept our Terms of Service.')).toBeInTheDocument()
    expect(canvas.getByRole('button', { name: DECLINE_LABEL })).toBeEnabled()
  },
}

/** Accepting: the button waits on the POST, and declining is off the table while it does. */
export const Accept: Story = {
  parameters: { msw: { handlers: [termsOfServiceMock, acceptNeverAnswersMock()] } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await userEvent.click(await canvas.findByRole('button', { name: AGREE_LABEL }))

    await waitFor(() => expect(canvas.getByRole('button', { name: DECLINE_LABEL })).toBeDisabled())
  },
}

/** Accepting rejected: the error shows and both buttons come back, so it can be tried again. */
export const AcceptFails: Story = {
  parameters: { msw: { handlers: [termsOfServiceMock, acceptServerErrorMock()] } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await userEvent.click(await canvas.findByRole('button', { name: AGREE_LABEL }))

    expect(await canvas.findByText('Something went wrong. Please try again later.')).toBeInTheDocument()
    expect(canvas.getByRole('button', { name: AGREE_LABEL })).toBeEnabled()
    expect(canvas.getByRole('button', { name: DECLINE_LABEL })).toBeEnabled()
  },
}
