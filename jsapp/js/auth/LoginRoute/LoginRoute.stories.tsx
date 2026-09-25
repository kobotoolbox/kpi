import type { Meta, StoryObj } from '@storybook/react-webpack5'
import { http, HttpResponse } from 'msw'
import type { RequestHandler } from 'msw'
import { reactRouterOutlet, reactRouterParameters, withRouter } from 'storybook-addon-remix-react-router'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import AuthContainer from '#/auth/AuthContainer/AuthContainer'
import {
  LOGIN_URL,
  loginAlreadyAuthenticatedMock,
  loginEmailVerificationRequiredMock,
  loginErrorsMock,
} from '#/endpoints/allauth.mocks'
import { emailConfirmationRequestedMock } from '#/endpoints/emailConfirmation.mocks'
import { environmentResponse, makeEnvironmentMock } from '#/endpoints/environment.mocks'
import { queryClientDecorator } from '#/query/queryClient.mocks'
import { AUTH_ROUTES, PATHS, ROUTES } from '#/router/routerConstants'
import { setAnonymousProfileForStories } from '#/stores/profile.mocks'
import LoginRoute from './LoginRoute'

const CREDENTIALS = {
  username: 'caroline_herschel',
  email: 'caroline.herschel@kbtdev.org',
  password: 'correct horse battery staple',
}

/** The stock server: `ACCOUNT_LOGIN_METHODS` unset, so allauth's default `username` applies. */
const environmentMock = makeEnvironmentMock()

/** An instance whose `ACCOUNT_LOGIN_METHODS` leaves `username` out, so only an address is accepted. */
const emailOnlyEnvironmentMock = makeEnvironmentMock({
  auth_configuration: { ...environmentResponse.auth_configuration, allow_login_with_username: false },
})

/** Where {@link loginRecordingMock} leaves the body it saw, for a story to check the keys of. */
let postedCredentials: unknown = null

/**
 * A successful sign-in that keeps the request body first: which key the credential went under is the whole
 * point of the email-only story, and it is invisible from the rendered output.
 */
const loginRecordingMock = () =>
  http.post(LOGIN_URL, async ({ request }) => {
    postedCredentials = await request.json()
    return HttpResponse.json({
      status: 200,
      data: {
        user: { id: 1, display: 'someone', username: 'someone', email: CREDENTIALS.email, has_usable_password: true },
        methods: [],
      },
      meta: { is_authenticated: true },
    })
  })

/**
 * Storybook replaces the handler array rather than merging it, so a story overriding the login handler
 * still has to restate `/environment`.
 */
const storyHandlers = (options?: { environment?: RequestHandler; login?: RequestHandler }): RequestHandler[] =>
  [options?.environment ?? environmentMock, options?.login].filter((handler): handler is RequestHandler =>
    Boolean(handler),
  )

/**
 * Stands in for the page load that a real success ends with. A navigation would take the test runner with
 * it, and the spy also shows the difference between "signed in" and "the server said something else".
 */
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
  title: 'Features/LoginRoute',
  component: AuthContainer,
  // Docs view can't render a full page frame usefully
  tags: ['!autodocs'],
  parameters: {
    layout: 'fullscreen',
    msw: { handlers: storyHandlers() },
    reactRouter: loginRouting,
  },
  // Nobody is logged in on a sign-in screen.
  beforeEach: setAnonymousProfileForStories,
  decorators: [withRouter, queryClientDecorator],
}

export default meta
type Story = StoryObj<typeof AuthContainer>

type Canvas = ReturnType<typeof within>

/** Finds an input by its label, which carries a required marker we don't want to spell out every time. */
const field = (canvas: Canvas, label: string) => canvas.getByLabelText(new RegExp(`^${label}`))

/**
 * Resolves once `/environment` has settled one way or the other: the button holds a spinner until it has,
 * so that nobody posts a credential under a key the server does not read.
 */
const waitForConfiguration = (canvas: Canvas) =>
  waitFor(() => expect(canvas.getByRole('button', { name: 'Log in' })).toBeEnabled())

const submit = (canvas: Canvas) => userEvent.click(canvas.getByRole('button', { name: 'Log in' }))

/** Fills both fields with something the client accepts. `label` is whichever credential is on offer. */
async function fillForm(canvas: Canvas, { label = 'Username', identifier = CREDENTIALS.username } = {}) {
  await waitForConfiguration(canvas)
  await userEvent.type(field(canvas, label), identifier)
  await userEvent.type(field(canvas, 'Password'), CREDENTIALS.password)
}

/** A stock server: username and password, and the two ways out of the form. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await waitForConfiguration(canvas)

    expect(field(canvas, 'Username')).toHaveAttribute('autocomplete', 'username')
    expect(canvas.queryByLabelText(/^Email/)).not.toBeInTheDocument()

    // Still the Django screen: the redesign lands in DEV-1852.
    expect(canvas.getByRole('link', { name: 'Forgot password?' })).toHaveAttribute('href', PATHS.RESET)
    // A router link, so signing up does not reload the page.
    expect(canvas.getByRole('link', { name: 'Create an account' })).toHaveAttribute('href', AUTH_ROUTES.REGISTER)
  },
}

/**
 * `allow_login_with_username` off: the field asks for an address, and - the part nothing on screen shows -
 * the credential is posted as `email`. allauth's `LoginInput` has no `username` field on such a server, so
 * the wrong key would only ever earn a 400.
 */
export const EmailOnlyServer: Story = {
  parameters: {
    msw: { handlers: storyHandlers({ environment: emailOnlyEnvironmentMock, login: loginRecordingMock() }) },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    onAuthenticated.mockClear()
    postedCredentials = null

    // `findBy`, not `getBy`: the field starts out asking for a username and switches once the response lands.
    await canvas.findByLabelText(/^Email/)
    expect(canvas.queryByLabelText(/^Username/)).not.toBeInTheDocument()

    await fillForm(canvas, { label: 'Email', identifier: CREDENTIALS.email })
    await submit(canvas)

    await waitFor(() => expect(onAuthenticated).toHaveBeenCalled())
    expect(postedCredentials).toEqual({ email: CREDENTIALS.email, password: CREDENTIALS.password })
  },
}

/** Nothing filled in, form submitted - both fields show errors and nothing is sent. */
export const ClientValidation: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    onAuthenticated.mockClear()

    await waitForConfiguration(canvas)
    await submit(canvas)

    // The rule itself is unit tested in `authValidation.tests`
    expect(await canvas.findAllByText('Required field')).toHaveLength(2)
    expect(onAuthenticated).not.toHaveBeenCalled()
  },
}

/**
 * Both kinds of rejection at once, and the reason the credential input is called `identifier`: allauth
 * names the field `username`, which no input here answers to, so the error has to be moved across or it
 * would never be seen. What was typed stays where it is, so a second attempt costs one field.
 */
export const ServerErrors: Story = {
  parameters: {
    msw: {
      handlers: storyHandlers({
        login: loginErrorsMock([
          { code: 'required', param: 'username', message: 'No account goes by that name.' },
          { code: 'too_many_login_attempts', message: 'Too many failed login attempts. Try again later.' },
        ]),
      }),
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    onAuthenticated.mockClear()

    await fillForm(canvas)
    await submit(canvas)

    // Field error - under the credential input, having arrived named for a field that is not there.
    await canvas.findByText('No account goes by that name.')
    // General error - above the form
    await canvas.findByText('Too many failed login attempts. Try again later.')

    expect(field(canvas, 'Username')).toHaveValue(CREDENTIALS.username)
    expect(onAuthenticated).not.toHaveBeenCalled()
  },
}

/**
 * The right password on an account whose address was never confirmed. allauth answers 401 with a pending
 * `verify_email` flow and mails a fresh link on its way out, so this is a waiting room rather than a
 * failure - and the address is known here because this server signs in by address.
 */
export const EmailVerificationRequired: Story = {
  parameters: {
    msw: {
      handlers: [emailOnlyEnvironmentMock, loginEmailVerificationRequiredMock(), emailConfirmationRequestedMock()],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    onAuthenticated.mockClear()

    await canvas.findByLabelText(/^Email/)
    await fillForm(canvas, { label: 'Email', identifier: CREDENTIALS.email })
    await submit(canvas)

    await canvas.findByRole('heading', { level: 1, name: 'Confirm your email address' })
    // The address it went to, so nobody has to type it again to ask for another link.
    await canvas.findByText(CREDENTIALS.email)
    expect(onAuthenticated).not.toHaveBeenCalled()

    // And that offer works, for a link that went astray or expired while it sat in an inbox.
    await userEvent.click(canvas.getByRole('button', { name: 'Request new link' }))
    await canvas.findByText(/a new confirmation email has been sent/)
  },
}

/** A 409: a session was already in place, which is nobody's mistake and nothing to fix. */
export const AlreadyLoggedIn: Story = {
  parameters: { msw: { handlers: storyHandlers({ login: loginAlreadyAuthenticatedMock() }) } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await fillForm(canvas)
    await submit(canvas)

    await canvas.findByRole('heading', { level: 1, name: 'You are already logged in' })
    // A plain `href`, so the click leaves `/auth` and loads the app with the session that was there.
    expect(canvas.getByRole('link', { name: 'Continue to KoboToolbox' })).toHaveAttribute('href', '/')
  },
}
