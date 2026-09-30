import type { Meta, StoryObj } from '@storybook/react-webpack5'
import { http, HttpResponse } from 'msw'
import type { RequestHandler } from 'msw'
import { reactRouterOutlet, reactRouterParameters, withRouter } from 'storybook-addon-remix-react-router'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import type { SocialApp } from '#/api/models/socialApp'
import AuthContainer from '#/auth/AuthContainer/AuthContainer'
import { type Canvas, field } from '#/auth/authStoryHelpers'
import {
  LOGIN_URL,
  allauthConfigurationMock,
  allauthConfigurationServerErrorMock,
  loginAlreadyAuthenticatedMock,
  loginEmailVerificationRequiredMock,
  loginErrorsMock,
} from '#/endpoints/allauth.mocks'
import { emailConfirmationRequestedMock } from '#/endpoints/emailConfirmation.mocks'
import { makeEnvironmentMock } from '#/endpoints/environment.mocks'
import { queryClientDecorator } from '#/query/queryClient.mocks'
import { AUTH_ROUTES, ROUTES } from '#/router/routerConstants'
import { setAnonymousProfileForStories } from '#/stores/profile.mocks'
import LoginRoute from './LoginRoute'

const CREDENTIALS = {
  username: 'caroline_herschel',
  email: 'caroline.herschel@kbtdev.org',
  password: 'correct horse battery staple',
}

const environmentMock = makeEnvironmentMock()

/** Two public providers, as `/environment` lists them, with `provider_id` set as an instance would set it. */
const socialApps: SocialApp[] = [
  {
    provider: 'gitlab',
    name: 'GitLab',
    client_id: 'gitlab-client-id',
    provider_id: 'gitlab-dev',
    managed: false,
    domains: [],
  },
  {
    provider: 'openid_connect',
    name: 'Example Organization',
    client_id: 'example-client-id',
    provider_id: 'example-org',
    managed: true,
    domains: ['kbtdev.org'],
  },
]

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
 * Storybook replaces the handler array rather than merging it, so overriding one handler means restating
 * the rest. `configuration` is allauth's, and decides which credential the form asks for.
 */
const storyHandlers = (options?: {
  environment?: RequestHandler
  configuration?: RequestHandler
  login?: RequestHandler
}): RequestHandler[] =>
  [
    options?.environment ?? environmentMock,
    options?.configuration ?? allauthConfigurationMock(['username']),
    options?.login,
  ].filter((handler): handler is RequestHandler => Boolean(handler))

/**
 * Stands in for the page load that a real success ends with. A navigation would take the test runner with
 * it, and the spy also shows the difference between "signed in" and "the server said something else".
 */
const onAuthenticated = fn()

/** Renders the story as `/accounts/login`, so what you see is the routed screen inside its frame. */
const loginRouting = reactRouterParameters({
  location: { path: AUTH_ROUTES.LOGIN },
  routing: reactRouterOutlet(
    { path: ROUTES.ACCOUNTS_ROOT },
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

/**
 * Resolves once allauth's settings have settled one way or the other: the button spins until they have, so
 * nobody posts a credential under a key the server does not read.
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

    // Both router links, so neither recovery nor signing up reloads the page.
    expect(canvas.getByRole('link', { name: 'Forgot password?' })).toHaveAttribute('href', AUTH_ROUTES.RESET_PASSWORD)
    expect(canvas.getByRole('link', { name: 'Create an account' })).toHaveAttribute('href', AUTH_ROUTES.SIGNUP)

    // No `social_apps`, so no single sign-on section at all - not an empty divider with nothing under it.
    expect(canvas.queryByText('or')).not.toBeInTheDocument()
  },
}

/** A server with single sign-on configured: one button per public provider, under the credentials. */
export const SingleSignOnProviders: Story = {
  parameters: { msw: { handlers: storyHandlers({ environment: makeEnvironmentMock({ social_apps: socialApps }) }) } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // `findBy`, not `getBy`: the buttons arrive with `/environment` rather than with the form.
    const gitlabButton = await canvas.findByRole('button', { name: 'Log in with GitLab' })
    await canvas.findByRole('button', { name: 'Log in with Example Organization' })
    // Separated from the credentials, which still work.
    await canvas.findByText('or')
    expect(canvas.getByRole('button', { name: 'Log in' })).toBeEnabled()

    // Where the click goes, which shows nowhere on screen: a real POST to allauth under the provider's
    // `provider_id`, not its `provider` kind.
    const form = gitlabButton.closest('form')
    expect(form).toHaveAttribute('action', '/api/v2/allauth/browser/v1/auth/provider/redirect')
    expect(form?.querySelector('input[name="provider"]')).toHaveValue('gitlab-dev')
  },
}

/**
 * `ACCOUNT_LOGIN_METHODS = {'email'}`: the field asks for an address and - invisible on screen - posts it
 * as `email`. allauth's `LoginInput` has no `username` field on such a server, so the other key earns a 400.
 */
export const EmailOnlyServer: Story = {
  parameters: {
    msw: {
      handlers: storyHandlers({ configuration: allauthConfigurationMock(['email']), login: loginRecordingMock() }),
    },
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

/**
 * `ACCOUNT_LOGIN_METHODS = {'username', 'email'}`: both are a way in, and the label has to say so. The
 * address still posts as `username`, which allauth resolves by address first on such a server.
 */
export const UsernameOrEmailServer: Story = {
  parameters: {
    msw: {
      handlers: storyHandlers({
        configuration: allauthConfigurationMock(['username', 'email']),
        login: loginRecordingMock(),
      }),
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    onAuthenticated.mockClear()
    postedCredentials = null

    await canvas.findByLabelText(/^Username or email address/)
    // Not `type='email'`: the browser would refuse the username half.
    expect(field(canvas, 'Username or email address')).toHaveAttribute('type', 'text')

    await fillForm(canvas, { label: 'Username or email address', identifier: CREDENTIALS.email })
    await submit(canvas)

    await waitFor(() => expect(onAuthenticated).toHaveBeenCalled())
    expect(postedCredentials).toEqual({ username: CREDENTIALS.email, password: CREDENTIALS.password })
  },
}

/**
 * allauth's settings never arrived, so there is no telling which credential this server takes. The form
 * stays away rather than guessing at the field name.
 */
export const ConfigurationUnavailable: Story = {
  parameters: { msw: { handlers: storyHandlers({ configuration: allauthConfigurationServerErrorMock() }) } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await canvas.findByRole('heading', { level: 1, name: 'Logging in is temporarily unavailable' })
    expect(canvas.getByRole('button', { name: 'Retry' })).toBeEnabled()

    // No form at all, rather than one that cannot work.
    expect(canvas.queryByLabelText(/^Password/)).not.toBeInTheDocument()
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
 * The right password on an account whose address was never confirmed: a 401 with a pending `verify_email`
 * flow, and no new email - KPI's `AccountAdapter` declines that on headless logins, so the panel has to
 * offer a link rather than announce one. The address is known because this server signs in by address.
 */
export const EmailVerificationRequired: Story = {
  parameters: {
    msw: {
      handlers: storyHandlers({
        configuration: allauthConfigurationMock(['email']),
        login: loginEmailVerificationRequiredMock(),
      }).concat(emailConfirmationRequestedMock()),
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
    await canvas.findByText(/A new verification link is on its way/)
    // The offer goes with it, rather than still asking to request one.
    expect(canvas.queryByRole('button', { name: 'Request new link' })).not.toBeInTheDocument()
  },
}

/**
 * The same unconfirmed account reached with a username, where allauth never says which address the account
 * uses - so asking for a new link starts by asking for the address.
 */
export const EmailVerificationRequiredWithoutAddress: Story = {
  parameters: {
    msw: {
      handlers: storyHandlers({ login: loginEmailVerificationRequiredMock() }).concat(emailConfirmationRequestedMock()),
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    onAuthenticated.mockClear()

    await fillForm(canvas)
    await submit(canvas)

    await canvas.findByRole('heading', { level: 1, name: 'Confirm your email address' })
    await canvas.findByText(/the verification link we sent to the email address on your account/)
    // Nothing here knows the address, and nothing pretends to.
    expect(canvas.queryByText(CREDENTIALS.email)).not.toBeInTheDocument()

    // So the resend asks for one.
    await userEvent.type(canvas.getByLabelText('Email'), CREDENTIALS.email)
    await userEvent.click(canvas.getByRole('button', { name: 'Request new link' }))

    // Once it is sent the field goes, rather than sitting under an instruction to fill it in.
    await canvas.findByText(/a new verification link is on its way/)
    expect(canvas.queryByLabelText('Email')).not.toBeInTheDocument()
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
    // A plain `href`, so the click leaves `/accounts` and loads the app with the session that was there.
    expect(canvas.getByRole('link', { name: 'Continue to KoboToolbox' })).toHaveAttribute('href', '/')
  },
}
