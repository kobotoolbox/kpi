import type { Meta, StoryObj } from '@storybook/react-webpack5'
import { http, HttpResponse } from 'msw'
import type { RequestHandler } from 'msw'
import { reactRouterOutlet, reactRouterParameters, withRouter } from 'storybook-addon-remix-react-router'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import AuthContainer from '#/auth/AuthContainer/AuthContainer'
import LoginRoute from '#/auth/LoginRoute/LoginRoute'
import { type Canvas, field } from '#/auth/authStoryHelpers'
import {
  MFA_AUTHENTICATE_URL,
  loginMfaRequiredMock,
  mfaErrorsMock,
  mfaFlowExpiredMock,
} from '#/endpoints/allauth.mocks'
import { makeEnvironmentMock } from '#/endpoints/environment.mocks'
import { queryClientDecorator } from '#/query/queryClient.mocks'
import { AUTH_ROUTES, ROUTES } from '#/router/routerConstants'
import { setAnonymousSessionForStories } from '#/stores/session.mocks'

const CREDENTIALS = { username: 'hildegard_of_bingen', password: 'correct horse battery staple' }
/** A token of the length `MFA_CODE_LENGTH` defaults to */
const TOKEN = '123456'

const environmentMock = makeEnvironmentMock()

/** An instance whose tokens are longer than the default six, which only the description shows. */
const longCodeEnvironmentMock = makeEnvironmentMock({ mfa_code_length: 8 })

let postedBody: unknown = null

const mfaRecordingMock = () =>
  http.post(MFA_AUTHENTICATE_URL, async ({ request }) => {
    postedBody = await request.json()
    return HttpResponse.json({
      status: 200,
      data: {
        user: { id: 1, display: 'someone', username: 'someone', has_usable_password: true },
        methods: [{ method: 'mfa', at: 1700000000, type: 'totp' }],
      },
      meta: { is_authenticated: true },
    })
  })

/**
 * Storybook replaces the handler array rather than merging it, so every story restates `/environment` and
 * the sign-in that asks for a code - that first step is what puts this form on screen.
 */
const storyHandlers = (options?: { environment?: RequestHandler; mfa?: RequestHandler }): RequestHandler[] =>
  [options?.environment ?? environmentMock, loginMfaRequiredMock(), options?.mfa].filter(
    (handler): handler is RequestHandler => Boolean(handler),
  )

const onAuthenticated = fn()

/** Renders the story as `/auth/login`, so what you see is the routed screen inside its frame. */
const loginRouting = reactRouterParameters({
  location: { path: AUTH_ROUTES.LOGIN },
  routing: reactRouterOutlet(
    { path: ROUTES.AUTH_ROOT },
    { path: 'login', element: <LoginRoute onAuthenticated={onAuthenticated} /> },
  ),
})

const meta: Meta<typeof AuthContainer> = {
  title: 'Features/MfaForm',
  component: AuthContainer,
  // Docs view can't render a full page frame usefully
  tags: ['!autodocs'],
  parameters: {
    layout: 'fullscreen',
    msw: { handlers: storyHandlers() },
    reactRouter: loginRouting,
  },
  // Nobody is logged in until the second factor is in: that is the whole point of it.
  beforeEach: setAnonymousSessionForStories,
  decorators: [withRouter, queryClientDecorator],
}

export default meta
type Story = StoryObj<typeof AuthContainer>

/**
 * Signs in with a password allauth accepts and then asks for a code for, which is the only way this form is
 * ever reached. Every story starts here.
 */
async function reachCodeForm(canvas: Canvas) {
  onAuthenticated.mockClear()
  postedBody = null

  // The login button holds a spinner until `/environment` says which credential this server takes
  await waitFor(() => expect(canvas.getByRole('button', { name: 'Log in' })).toBeEnabled())
  await userEvent.type(field(canvas, 'Username'), CREDENTIALS.username)
  await userEvent.type(field(canvas, 'Password'), CREDENTIALS.password)
  await userEvent.click(canvas.getByRole('button', { name: 'Log in' }))

  await canvas.findByRole('heading', { level: 1, name: 'Please enter your verification token or backup code' })
}

const submit = (canvas: Canvas) => userEvent.click(canvas.getByRole('button', { name: 'Continue' }))

/** Fills in a token the client is happy with and sends it, for the stories the answer is the point of. */
async function submitCode(canvas: Canvas) {
  await userEvent.type(field(canvas, 'Code'), TOKEN)
  await submit(canvas)
}

/** Swaps the form for the help panel, and waits until it is really there. */
async function openVerificationIssues(canvas: Canvas) {
  await userEvent.click(canvas.getByRole('button', { name: 'Problem with token?' }))
  await canvas.findByRole('heading', { level: 1, name: 'Verification issues' })
}

export const Default: Story = {}

/** An instance with longer tokens configured */
export const LongerCode: Story = {
  parameters: { msw: { handlers: storyHandlers({ environment: longCodeEnvironmentMock }) } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await reachCodeForm(canvas)

    await canvas.findByText(/Use the 8-character token displayed by your authenticator app/)
  },
}

/** The code allauth was waiting for */
export const Accepted: Story = {
  parameters: { msw: { handlers: storyHandlers({ mfa: mfaRecordingMock() }) } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await reachCodeForm(canvas)

    // Padded on purpose - a code read off a phone tends to arrive with a space on it.
    await userEvent.type(field(canvas, 'Code'), `  ${TOKEN}  `)
    await submit(canvas)

    await canvas.findByRole('heading', { level: 1, name: 'Signing you in…' })
    await waitFor(() => expect(onAuthenticated).toHaveBeenCalled())
    expect(postedBody).toEqual({ code: TOKEN })
  },
}

/** Both kinds of rejection at once: one under the input, one in the banner. The code stays for a second go. */
export const ServerErrors: Story = {
  parameters: {
    msw: {
      handlers: storyHandlers({
        mfa: mfaErrorsMock([
          { code: 'incorrect_code', param: 'code', message: 'Incorrect code.' },
          { code: 'throttled', message: 'Too many failed attempts. Try again later.' },
        ]),
      }),
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await reachCodeForm(canvas)

    await submitCode(canvas)

    await canvas.findByText('Incorrect code.')
    await canvas.findByText('Too many failed attempts. Try again later.')

    expect(field(canvas, 'Code')).toHaveValue(TOKEN)
    expect(onAuthenticated).not.toHaveBeenCalled()
  },
}

/** What to do without the authenticator app. Reached from the form's button. */
export const VerificationIssues: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await reachCodeForm(canvas)

    await openVerificationIssues(canvas)

    await canvas.findByText(/If you cannot access your authenticator app, please enter one of your backup codes/)
    expect(canvas.queryByLabelText(/^Code/)).not.toBeInTheDocument()
  },
}

/**
 * allauth stopped waiting for the code - the session holding the half-finished sign-in went away. A second
 * try at the code would be pointless, so the card says so instead of showing the field again.
 */
export const LoginAttemptExpired: Story = {
  parameters: { msw: { handlers: storyHandlers({ mfa: mfaFlowExpiredMock() }) } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await reachCodeForm(canvas)

    await submitCode(canvas)

    await canvas.findByRole('heading', { level: 1, name: 'Your login attempt has expired' })
    expect(onAuthenticated).not.toHaveBeenCalled()
  },
}
