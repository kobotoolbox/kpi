import type { Meta, StoryObj } from '@storybook/react-webpack5'
import { http, HttpResponse, delay } from 'msw'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { getApiV2TermsOfServiceListMockHandler } from '#/api/react-query/other/msw'
import { logoutNeverAnswersMock } from '#/endpoints/allauth.mocks'
import { queryClientDecorator } from '#/query/queryClient.mocks'
import TOSForm from './tosForm.component'

/**
 * The form now covers the terms and nothing else - the profile details it used to collect have their own
 * blocker, so see `ProfileDetailsScreen.stories` for those.
 */

// A minimal announcement so the form gets past its loading guard. Without a message whose slug is
// `terms_of_service` the form would spin forever.
const termsOfServiceMock = getApiV2TermsOfServiceListMockHandler([
  {
    url: 'http://kf.kobo.local/api/v2/terms-of-service/terms_of_service/',
    slug: 'terms_of_service',
    body: '<h1>Terms of Service</h1>\n<p>Please accept our Terms of Service.</p>',
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

const meta: Meta<typeof TOSForm> = {
  title: 'Components/TOSForm',
  component: TOSForm,
  // Docs view doesn't work :sadface: :angryface: --> turning it off
  tags: ['!autodocs'],
  parameters: {
    msw: { handlers: [termsOfServiceMock] },
    // The announcement is administrator-supplied HTML injected as-is, and its heading order is not this
    // component's to fix.
    a11y: { disable: true },
  },
  decorators: [queryClientDecorator],
}

export default meta
type Story = StoryObj<typeof TOSForm>

const AGREE = /i agree/i
const DECLINE = /i don't agree/i

/** The announcement, with the two ways to answer it. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await canvas.findByRole('button', { name: AGREE })
    expect(canvas.getByText('Please accept our Terms of Service.')).toBeInTheDocument()
    expect(canvas.getByRole('button', { name: DECLINE })).toBeEnabled()
  },
}

/** Accepting: the button waits on the POST, and declining is off the table while it does. */
export const Accept: Story = {
  parameters: { msw: { handlers: [termsOfServiceMock, acceptNeverAnswersMock()] } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await userEvent.click(await canvas.findByRole('button', { name: AGREE }))

    await waitFor(() => expect(canvas.getByRole('button', { name: DECLINE })).toBeDisabled())
  },
}

/** Accepting rejected: both buttons come back, so it can be tried again. */
export const AcceptFails: Story = {
  parameters: { msw: { handlers: [termsOfServiceMock, acceptServerErrorMock()] } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await userEvent.click(await canvas.findByRole('button', { name: AGREE }))

    await waitFor(() => expect(canvas.getByRole('button', { name: DECLINE })).toBeEnabled())
  },
}

/** Declining logs the user out. A logout that never answers keeps the pending state up to be seen. */
export const Decline: Story = {
  parameters: { msw: { handlers: [termsOfServiceMock, logoutNeverAnswersMock()] } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await userEvent.click(await canvas.findByRole('button', { name: DECLINE }))

    await waitFor(() => expect(canvas.getByRole('button', { name: DECLINE })).toBeDisabled())
  },
}

/** No message with the expected slug: the form has nothing to show and stays on its spinner. */
export const NoAnnouncement: Story = {
  parameters: { msw: { handlers: [getApiV2TermsOfServiceListMockHandler([])] } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await waitFor(() => expect(canvas.queryByRole('button', { name: AGREE })).not.toBeInTheDocument())
  },
}
