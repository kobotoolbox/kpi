import type { Meta, StoryObj } from '@storybook/react-webpack5'
import { http, HttpResponse } from 'msw'
import type { RequestHandler } from 'msw'
import { reactRouterOutlet, reactRouterParameters, withRouter } from 'storybook-addon-remix-react-router'
import { expect, userEvent, within } from 'storybook/test'
import AuthContainer from '#/auth/AuthContainer/AuthContainer'
import { PASSWORD_REQUEST_URL, passwordRequestErrorsMock } from '#/endpoints/allauth.mocks'
import { makeEnvironmentMock } from '#/endpoints/environment.mocks'
import { queryClientDecorator } from '#/query/queryClient.mocks'
import { AUTH_ROUTES, ROUTES } from '#/router/routerConstants'
import { setAnonymousSessionForStories } from '#/stores/session.mocks'
import ResetPasswordRoute from './ResetPasswordRoute'

const EMAIL = 'caroline.herschel@kbtdev.org'

const environmentMock = makeEnvironmentMock()

/** Where {@link requestRecordingMock} leaves the body it saw, for a story to check the address of. */
let postedBody: unknown = null

/** A taken request that keeps the body first: the address is trimmed on its way out, which nothing shows. */
const requestRecordingMock = () =>
  http.post(PASSWORD_REQUEST_URL, async ({ request }) => {
    postedBody = await request.json()
    return HttpResponse.json({ status: 200 })
  })

/**
 * Storybook replaces the handler array rather than merging it, so a story overriding the request handler
 * still has to restate `/environment`.
 */
const storyHandlers = (options?: { environment?: RequestHandler; request?: RequestHandler }): RequestHandler[] =>
  [options?.environment ?? environmentMock, options?.request].filter((handler): handler is RequestHandler =>
    Boolean(handler),
  )

/** Renders the story as `/auth/reset-password`, so what you see is the routed screen inside its frame. */
const resetPasswordRouting = reactRouterParameters({
  location: { path: AUTH_ROUTES.RESET_PASSWORD },
  routing: reactRouterOutlet({ path: ROUTES.AUTH_ROOT }, { path: 'reset-password', element: <ResetPasswordRoute /> }),
})

const meta: Meta<typeof AuthContainer> = {
  title: 'Features/ResetPasswordRoute',
  component: AuthContainer,
  // Docs view can't render a full page frame usefully
  tags: ['!autodocs'],
  parameters: {
    layout: 'fullscreen',
    msw: { handlers: storyHandlers() },
    reactRouter: resetPasswordRouting,
  },
  // Nobody is logged in when they have forgotten their password.
  beforeEach: setAnonymousSessionForStories,
  decorators: [withRouter, queryClientDecorator],
}

export default meta
type Story = StoryObj<typeof AuthContainer>

type Canvas = ReturnType<typeof within>

/** Finds an input by its label, which carries a required marker we don't want to spell out every time. */
const field = (canvas: Canvas, label: string) => canvas.getByLabelText(new RegExp(`^${label}`))

const submit = (canvas: Canvas) => userEvent.click(canvas.getByRole('button', { name: 'Reset password' }))

export const Default: Story = {}

/** A taken request. The panel never names the address, so this form cannot be used to find who has an account. */
export const EmailSent: Story = {
  parameters: { msw: { handlers: storyHandlers({ request: requestRecordingMock() }) } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    postedBody = null

    // Padded on purpose: the address is trimmed before it is posted, which the assertion below is about.
    await userEvent.type(field(canvas, 'Email'), `  ${EMAIL}  `)
    await submit(canvas)

    await canvas.findByRole('heading', { level: 1, name: 'Email has been sent' })
    await canvas.findByText(/If the email address you entered corresponds to an account/)
    await canvas.findByText(/your account might be registered under a different address/)

    // The whole form is replaced, so nothing invites a second attempt.
    expect(canvas.queryByLabelText(/^Email/)).not.toBeInTheDocument()
    expect(postedBody).toEqual({ email: EMAIL })
  },
}

/** Nothing filled in, then a malformed address - neither reaches the server. */
export const ClientValidation: Story = {
  parameters: { msw: { handlers: storyHandlers({ request: requestRecordingMock() }) } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    postedBody = null

    await submit(canvas)
    // The rules themselves are unit tested in `authValidation.tests`
    await canvas.findByText('Required field')

    await userEvent.type(field(canvas, 'Email'), 'caroline@kbtdev')
    await submit(canvas)
    await canvas.findByText('Please enter a valid email address')

    expect(postedBody).toBe(null)
  },
}

/** Both kinds of rejection at once: one under the input, one in the banner above the form. */
export const ServerErrors: Story = {
  parameters: {
    msw: {
      handlers: storyHandlers({
        request: passwordRequestErrorsMock([
          { code: 'invalid', param: 'email', message: 'Enter a valid email address.' },
          { code: 'throttled', message: 'Too many requests. Try again later.' },
        ]),
      }),
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await userEvent.type(field(canvas, 'Email'), EMAIL)
    await submit(canvas)

    await canvas.findByText('Enter a valid email address.')
    await canvas.findByText('Too many requests. Try again later.')
    // What was typed stays put, so a second attempt costs nothing.
    expect(field(canvas, 'Email')).toHaveValue(EMAIL)
  },
}
