import type { Meta, StoryObj } from '@storybook/react-webpack5'
import { http, HttpResponse } from 'msw'
import type { RequestHandler } from 'msw'
import {
  reactRouterOutlet,
  reactRouterOutlets,
  reactRouterParameters,
  withRouter,
} from 'storybook-addon-remix-react-router'
import { expect, userEvent, within } from 'storybook/test'
import AuthContainer from '#/auth/AuthContainer/AuthContainer'
import NewPasswordRoute from '#/auth/NewPasswordRoute/NewPasswordRoute'
import { type Canvas, field } from '#/auth/authStoryHelpers'
import {
  PASSWORD_REQUEST_URL,
  PASSWORD_RESET_URL,
  passwordRequestCodeSentMock,
  passwordRequestErrorsMock,
} from '#/endpoints/allauth.mocks'
import { makeEnvironmentMock } from '#/endpoints/environment.mocks'
import { queryClientDecorator } from '#/query/queryClient.mocks'
import { AUTH_ROUTES, ROUTES } from '#/router/routerConstants'
import { setAnonymousProfileForStories } from '#/stores/profile.mocks'
import ResetPasswordRoute from './ResetPasswordRoute'

const EMAIL = 'caroline.herschel@kbtdev.org'
/** Six characters, like the ones allauth generates */
const CODE = 'MK4T9Z'

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

/** Renders the story as `/accounts/password/reset`, so what you see is the routed screen inside its frame. */
const resetPasswordRouting = reactRouterParameters({
  location: { path: AUTH_ROUTES.RESET_PASSWORD },
  routing: reactRouterOutlet(
    { path: ROUTES.ACCOUNTS_ROOT },
    { path: 'password/reset', element: <ResetPasswordRoute /> },
  ),
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
  beforeEach: setAnonymousProfileForStories,
  decorators: [withRouter, queryClientDecorator],
}

export default meta
type Story = StoryObj<typeof AuthContainer>

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

/** Where {@link keyCheckRecordingMock} leaves the key it was asked about, to show the code arrived as one. */
let checkedKey: string | null = null

/** A good key, keeping the header first: that the typed code became the reset key is the point of the story. */
const keyCheckRecordingMock = () =>
  http.get(PASSWORD_RESET_URL, ({ request }) => {
    checkedKey = request.headers.get('X-Password-Reset-Key')
    return HttpResponse.json({
      status: 200,
      data: { user: { id: 1, display: 'caroline', username: 'caroline', has_usable_password: true } },
    })
  })

/** A server that mails a code. The code is a reset key, so typing it reaches the screen a link would have. */
export const ResetByCode: Story = {
  parameters: {
    msw: { handlers: storyHandlers({ request: passwordRequestCodeSentMock() }).concat(keyCheckRecordingMock()) },
    // The code is handed on as a route param, so this story needs the screen it is handed to.
    reactRouter: reactRouterParameters({
      location: { path: AUTH_ROUTES.RESET_PASSWORD },
      routing: reactRouterOutlets({ path: ROUTES.AUTH_ROOT }, [
        { path: 'reset-password', element: <ResetPasswordRoute /> },
        { path: 'reset-password/:key', element: <NewPasswordRoute /> },
      ]),
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    checkedKey = null

    await userEvent.type(field(canvas, 'Email'), EMAIL)
    await submit(canvas)

    // A code field rather than "check your inbox": there is nowhere else to finish this.
    await canvas.findByRole('heading', { level: 1, name: 'Enter your reset code' })
    await userEvent.type(field(canvas, 'Password reset code'), CODE)
    await userEvent.click(canvas.getByRole('button', { name: 'Continue' }))

    // The second half of recovery, same as arriving from a link.
    await canvas.findByLabelText(/^New password/)
    expect(checkedKey).toBe(CODE)
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
