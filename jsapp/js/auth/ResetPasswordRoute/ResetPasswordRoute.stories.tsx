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
const PASSWORD = 'correct horse battery staple'

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

/** Where {@link resetRecordingMock} leaves the key it was posted, to show the typed code arrived as one. */
let postedKey: unknown = null

/** Accepts one code and rejects the rest, like a server with attempts left. 401 means the password changed. */
const resetRecordingMock = () =>
  http.post(PASSWORD_RESET_URL, async ({ request }) => {
    const body = (await request.json()) as { key?: string }
    postedKey = body.key
    if (body.key !== CODE) {
      return HttpResponse.json(
        { status: 400, errors: [{ code: 'invalid', param: 'key', message: 'Invalid or expired key.' }] },
        { status: 400 },
      )
    }
    return HttpResponse.json(
      { status: 401, data: { flows: [{ id: 'login' }] }, meta: { is_authenticated: false } },
      { status: 401 },
    )
  })

/**
 * A server that mails a code. The code posts as the reset key, and it is never looked up first: attempts are
 * few, so the one POST that sets the password is the only one spent.
 */
export const ResetByCode: Story = {
  parameters: {
    msw: { handlers: storyHandlers({ request: passwordRequestCodeSentMock() }).concat(resetRecordingMock()) },
    // The code screen is a route of its own, so the story has to carry it as well as the request form.
    reactRouter: reactRouterParameters({
      location: { path: AUTH_ROUTES.RESET_PASSWORD },
      routing: reactRouterOutlets({ path: ROUTES.AUTH_ROOT }, [
        { path: 'reset-password', element: <ResetPasswordRoute /> },
        { path: 'reset-password/code', element: <NewPasswordRoute collectCode /> },
      ]),
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    postedKey = null

    await userEvent.type(field(canvas, 'Email'), EMAIL)
    await submit(canvas)

    // Straight to the form that sets the password, code field and all - no "check your inbox" in between.
    await canvas.findByRole('heading', { level: 1, name: 'Create new password' })
    await canvas.findByText(/Enter the code from the password reset email/)

    // A typo first, which is the case that must not leave this screen: attempts are limited, and being sent
    // off to "request another email" would spend one for nothing.
    await userEvent.type(field(canvas, 'Password reset code'), 'MK4T92')
    await userEvent.type(field(canvas, 'New password'), PASSWORD)
    await userEvent.type(field(canvas, 'Confirm password'), PASSWORD)
    await userEvent.click(canvas.getByRole('button', { name: 'Change password' }))

    await canvas.findByText(/That code is not valid or has expired/)
    expect(field(canvas, 'Password reset code')).toHaveValue('MK4T92')
    expect(canvas.queryByRole('link', { name: 'Go back to Login' })).not.toBeInTheDocument()

    // Corrected in place, with the passwords still typed in and no new email needed.
    await userEvent.clear(field(canvas, 'Password reset code'))
    await userEvent.type(field(canvas, 'Password reset code'), CODE)
    await userEvent.click(canvas.getByRole('button', { name: 'Change password' }))

    await canvas.findByRole('heading', { level: 1, name: 'Password has been successfully changed' })
    expect(postedKey).toBe(CODE)
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
