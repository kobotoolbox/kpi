import type { Meta, StoryObj } from '@storybook/react-webpack5'
import type { RequestHandler } from 'msw'
import { getWorker } from 'msw-storybook-addon'
import { reactRouterOutlet, reactRouterParameters, withRouter } from 'storybook-addon-remix-react-router'
import { expect, fn, userEvent, within } from 'storybook/test'
import { AuthThemeEnum } from '#/api/models/authThemeEnum'
import AuthContainer from '#/auth/AuthContainer/AuthContainer'
import { setLoginBackgroundMetaForStories } from '#/auth/AuthContainer/authContainer.mocks'
// The same stand-in photo the container's own stories use, so the custom theme stays offline.
import backgroundImageUrl from '#/auth/AuthContainer/salah-darwish-story-bg.webp'
import { type Canvas, field, narrowViewportDecorator } from '#/auth/authStoryHelpers'
import {
  providerSignupAuthenticatedMock,
  providerSignupErrorsMock,
  providerSignupFlowExpiredMock,
  providerSignupLookupNeverAnswersMock,
  providerSignupLookupServerErrorMock,
  providerSignupNeverAnswersMock,
  providerSignupNothingPendingMock,
  providerSignupPendingMock,
  providerSignupPendingVerificationMock,
  providerSignupServerErrorMock,
} from '#/endpoints/allauth.mocks'
import { makeAuthConfigurationMock, makeEnvironmentMock } from '#/endpoints/environment.mocks'
import { queryClientDecorator } from '#/query/queryClient.mocks'
import { AUTH_ROUTES, ROUTES } from '#/router/routerConstants'
import { setAnonymousProfileForStories } from '#/stores/profile.mocks'
import ProviderSignupRoute from './ProviderSignupRoute'

/**
 * The screen a single sign-on handshake comes back to, in `AuthContainer`'s outlet where it really lives -
 * hence the container, not the route, as the story component.
 *
 * Every story starts from what allauth says the state is: a pending provider signup, nothing pending, or a
 * lookup that failed. The route asks before it renders, so that one handler decides the whole screen.
 */

const PROVIDER_NAME = 'Example Organization'

/** What the provider handed over, which is what the form starts filled in with. */
const PROVIDER_ACCOUNT = {
  display: 'Sally Ride',
  email: 'sallyride@nasa.com',
  username: 'sallyride',
  providerName: PROVIDER_NAME,
}

const environmentMock = makeEnvironmentMock()

/** Both supporting fields filled in: a `login_supporting_image` upload and a `welcome_message`, as HTML. */
const supportingEnvironmentMock = makeAuthConfigurationMock({
  supporting_image_url: backgroundImageUrl,
  supporting_text: '<h2>Welcome to the Example Organization server</h2>\n<p>Accounts here are for staff.</p>',
})

/**
 * Storybook replaces the handler array rather than merging it, so a story overriding one half of the signup
 * endpoint still has to restate `/environment` and the other half. The `GET` decides which panel renders;
 * the `POST` decides what submitting it does.
 */
const storyHandlers = (options?: {
  environment?: RequestHandler
  pending?: RequestHandler
  submit?: RequestHandler
}): RequestHandler[] =>
  [
    options?.environment ?? environmentMock,
    options?.pending ?? providerSignupPendingMock(PROVIDER_ACCOUNT),
    options?.submit,
  ].filter((handler): handler is RequestHandler => Boolean(handler))

/**
 * Renders the story as `/accounts/provider/signup`, where allauth's `callback_url` points.
 *
 * `error` goes on the route's own search string rather than `window.location`, which is where allauth really
 * writes it - the route reads both, exactly so that stories can drive this. See `readProviderRedirectError`.
 */
const providerSignupRouting = (search?: string) =>
  reactRouterParameters({
    location: { path: AUTH_ROUTES.PROVIDER_SIGNUP, searchParams: search ? { error: search } : {} },
    routing: reactRouterOutlet({ path: ROUTES.ACCOUNTS_ROOT }, { path: 'provider/signup', element: <Subject /> }),
  })

/** Where {@link onAuthenticated} is wired in, so no story ever navigates Storybook away to `/`. */
const onAuthenticated = fn()

const Subject = () => <ProviderSignupRoute onAuthenticated={onAuthenticated} />

const meta: Meta<typeof AuthContainer> = {
  title: 'Features/ProviderSignupRoute',
  component: AuthContainer,
  // Docs view can't render a full page frame usefully
  tags: ['!autodocs'],
  parameters: {
    layout: 'fullscreen',
    msw: { handlers: storyHandlers() },
    reactRouter: providerSignupRouting(),
  },
  // Nobody is logged in while their account is still being created. Returning the teardown is not optional -
  // see `setAnonymousProfileForStories`.
  beforeEach: () => {
    onAuthenticated.mockClear()
    return setAnonymousProfileForStories()
  },
  decorators: [withRouter, queryClientDecorator],
}

export default meta
type Story = StoryObj<typeof AuthContainer>

const submit = (canvas: Canvas) => userEvent.click(canvas.getByRole('button', { name: 'Continue' }))

/** Waits for the pending signup to land, which is what fills the fields in. */
const waitForForm = (canvas: Canvas) => canvas.findByLabelText(/^Full name/)

/** The main flow: what the provider knew is already filled in, leaving only the gaps. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await canvas.findByRole('heading', { level: 1, name: 'Create your account' })
    await canvas.findByText(`Finish setting up your KoboToolbox account, connected to your ${PROVIDER_NAME} account.`)

    // Prefilled from the provider, rather than asking again for what it already told us.
    expect(field(canvas, 'Full name')).toHaveValue(PROVIDER_ACCOUNT.display)
    expect(field(canvas, 'Email')).toHaveValue(PROVIDER_ACCOUNT.email)
    expect(field(canvas, 'Username')).toHaveValue(PROVIDER_ACCOUNT.username)

    // No password: the provider is the credential.
    expect(canvas.queryByLabelText(/^Password/)).not.toBeInTheDocument()
    expect(canvas.queryByLabelText(/^Confirm password/)).not.toBeInTheDocument()
  },
}

/** A provider that handed over nothing but a display name, which plenty of OIDC deployments do. */
export const NothingPrefilled: Story = {
  parameters: {
    msw: {
      handlers: storyHandlers({
        pending: providerSignupPendingMock({
          display: 'Sally Ride',
          email: '',
          username: '',
          providerName: PROVIDER_NAME,
        }),
      }),
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await waitForForm(canvas)
    expect(field(canvas, 'Full name')).toHaveValue('Sally Ride')
    // Blank rather than absent: these are the gaps this form exists to fill.
    expect(field(canvas, 'Email')).toHaveValue('')
    expect(field(canvas, 'Username')).toHaveValue('')
  },
}

/** Supporting content - custom image and text - second column appears */
export const WithSupportingContent: Story = {
  parameters: { msw: { handlers: storyHandlers({ environment: supportingEnvironmentMock }) } },
  play: async ({ canvasElement }) => {
    await within(canvasElement).findByRole('heading', { level: 2, name: /Example Organization/ })
  },
}

/** Same as above, but on narrow screen */
export const WithSupportingContentStacked: Story = {
  parameters: { msw: { handlers: storyHandlers({ environment: supportingEnvironmentMock }) } },
  decorators: [narrowViewportDecorator],
  play: async ({ canvasElement }) => {
    await within(canvasElement).findByRole('heading', { level: 2, name: /Example Organization/ })
  },
}

/** A server with its own colours and background photo, which this screen inherits from the frame. */
export const CustomTheme: Story = {
  parameters: {
    msw: {
      handlers: storyHandlers({
        environment: makeAuthConfigurationMock({
          theme: AuthThemeEnum.custom,
          background_image_url: backgroundImageUrl,
        }),
      }),
    },
  },
  beforeEach: setLoginBackgroundMetaForStories(backgroundImageUrl),
  play: async ({ canvasElement }) => {
    await within(canvasElement).findByRole('heading', { level: 1, name: 'Create your account' })
  },
}

/** Emptied fields, then a malformed address - neither reaches the server. */
export const ClientValidation: Story = {
  parameters: { msw: { handlers: storyHandlers({ submit: providerSignupNeverAnswersMock() }) } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await waitForForm(canvas)
    // The provider filled these in, so there is something to clear before anything can be missing.
    await userEvent.clear(field(canvas, 'Full name'))
    await userEvent.clear(field(canvas, 'Email'))
    await userEvent.clear(field(canvas, 'Username'))
    await submit(canvas)

    // The rules themselves are unit tested in `registerValidation.tests` and `authValidation.tests`
    expect(await canvas.findAllByText('Required field')).toHaveLength(3)

    await userEvent.type(field(canvas, 'Email'), 'not-an-address')
    await submit(canvas)
    await canvas.findByText('Please enter a valid email address')
  },
}

/** The submit button holds a spinner until the server answers. */
export const SubmitForm: Story = {
  parameters: { msw: { handlers: storyHandlers({ submit: providerSignupNeverAnswersMock() }) } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await waitForForm(canvas)
    await submit(canvas)

    expect(canvas.getByRole('button', { name: 'Continue' })).toBeDisabled()
  },
}

/** The happy path on a KPI default: a 401 with a pending `verify_email` flow, treated as success. */
export const SubmitPendingVerification: Story = {
  parameters: { msw: { handlers: storyHandlers({ submit: providerSignupPendingVerificationMock() }) } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await waitForForm(canvas)
    await submit(canvas)

    // An address that came from a provider is still not a confirmed address.
    await canvas.findByRole('heading', { level: 1, name: 'Confirm your email address' })
    await canvas.findByText(PROVIDER_ACCOUNT.email)
    expect(onAuthenticated).not.toHaveBeenCalled()
  },
}

/**
 * A deployment that does not verify addresses: the account comes back already signed in, so the card holds
 * still while the browser leaves for the app.
 */
export const SubmitAuthenticated: Story = {
  parameters: { msw: { handlers: storyHandlers({ submit: providerSignupAuthenticatedMock() }) } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await waitForForm(canvas)
    await submit(canvas)

    await canvas.findByRole('heading', { level: 1, name: 'Signing you in…' })
    // The real route hands this to `window.location.assign('/')` - see `ProviderSignupRouteProps`.
    expect(onAuthenticated).toHaveBeenCalledTimes(1)
  },
}

/** Both kinds of server error at once: one attributed to a field, one that belongs to no field. */
export const ServerErrors: Story = {
  parameters: {
    msw: {
      handlers: storyHandlers({
        submit: providerSignupErrorsMock([
          { code: 'username_taken', param: 'username', message: 'A user with that username already exists.' },
          { code: 'invalid', message: 'Sign up is temporarily unavailable. Please try again in a few minutes.' },
        ]),
      }),
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await waitForForm(canvas)
    await submit(canvas)

    // Field error - under the input it is about. The likeliest one here: providers hand over handles that
    // are already taken on this server.
    await canvas.findByText('A user with that username already exists.')
    // General error - above the form.
    await canvas.findByText('Sign up is temporarily unavailable. Please try again in a few minutes.')
    // The form stays put with what the provider gave us, so a new username costs one field.
    expect(field(canvas, 'Username')).toHaveValue(PROVIDER_ACCOUNT.username)
  },
}

/** A 500 leaves us nothing to quote, so the banner gets our own wording and the form stays fillable. */
export const ServerUnavailable: Story = {
  parameters: { msw: { handlers: storyHandlers({ submit: providerSignupServerErrorMock() }) } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await waitForForm(canvas)
    await submit(canvas)

    await canvas.findByText('Something went wrong. Please try again later.')
    expect(field(canvas, 'Username')).toHaveValue(PROVIDER_ACCOUNT.username)
  },
}

/** The flow went away under a filled in form - another tab finished it, or the session holding it expired. */
export const FlowExpiredOnSubmit: Story = {
  parameters: { msw: { handlers: storyHandlers({ submit: providerSignupFlowExpiredMock() }) } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await waitForForm(canvas)
    await submit(canvas)

    await canvas.findByRole('heading', { level: 1, name: 'Your login attempt has expired' })
    // The form goes: there is nothing left for it to complete.
    expect(canvas.queryByLabelText(/^Full name/)).not.toBeInTheDocument()
    expect(canvas.getByRole('link', { name: 'Back to login' })).toHaveAttribute('href', AUTH_ROUTES.LOGIN)
  },
}

/** Landing here with no handshake behind it at all: allauth answers 409 and there is nothing to fill in. */
export const NothingPending: Story = {
  parameters: { msw: { handlers: storyHandlers({ pending: providerSignupNothingPendingMock() }) } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await canvas.findByRole('heading', { level: 1, name: 'Your login attempt has expired' })
    expect(canvas.queryByLabelText(/^Full name/)).not.toBeInTheDocument()
    expect(canvas.getByRole('link', { name: 'Back to login' })).toHaveAttribute('href', AUTH_ROUTES.LOGIN)
  },
}

/** A handshake the provider's own screen was cancelled on: nothing pending, and an `?error=` saying why. */
export const HandshakeCancelled: Story = {
  parameters: {
    reactRouter: providerSignupRouting('cancelled'),
    msw: { handlers: storyHandlers({ pending: providerSignupNothingPendingMock() }) },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await canvas.findByRole('heading', { level: 1, name: 'Your login attempt has expired' })
    // The specific wording, rather than the generic "no longer valid": we know what went wrong here.
    await canvas.findByText('The login was cancelled before it finished. You can try again.')
  },
}

/** The provider refused outright - an account not entitled to this application, typically. */
export const HandshakeDenied: Story = {
  parameters: {
    reactRouter: providerSignupRouting('denied'),
    msw: { handlers: storyHandlers({ pending: providerSignupNothingPendingMock() }) },
  },
  play: async ({ canvasElement }) => {
    await within(canvasElement).findByText(
      'Your login provider refused the request. Please contact your administrator if this continues.',
    )
  },
}

/**
 * An `?error=` alongside a signup that is pending anyway - a second attempt in another tab, say. The form is
 * what matters, so the message goes above it rather than replacing it.
 */
export const ErrorWithPendingSignup: Story = {
  parameters: { reactRouter: providerSignupRouting('unknown') },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await waitForForm(canvas)
    await canvas.findByText('We could not complete the login with your provider. Please try again.')
    // Still fillable: there is a real pending signup behind the message.
    expect(field(canvas, 'Email')).toHaveValue(PROVIDER_ACCOUNT.email)
  },
}

/** While the lookup is in flight there is nothing to prefill from, so the card says what it is doing. */
export const LoadingPendingSignup: Story = {
  parameters: { msw: { handlers: storyHandlers({ pending: providerSignupLookupNeverAnswersMock() }) } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await canvas.findByText('One moment, we are finishing your login…')
    // An empty form before the answer would throw away what the provider told us.
    expect(canvas.queryByLabelText(/^Full name/)).not.toBeInTheDocument()
  },
}

/** A broken lookup is not a missing flow, so this offers a retry instead of a handshake all over again. */
export const LookupError: Story = {
  parameters: { msw: { handlers: storyHandlers({ pending: providerSignupLookupServerErrorMock() }) } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await canvas.findByRole('heading', { level: 1, name: 'Something went wrong' })
    // Deliberately not the expiry panel: a 500 says nothing about whether the flow is still there.
    expect(canvas.queryByRole('heading', { name: 'Your login attempt has expired' })).not.toBeInTheDocument()

    // Put the endpoint back on its feet first, so the click has something to succeed with. The addon resets
    // runtime handlers between stories, so this stays inside this one.
    getWorker().use(providerSignupPendingMock(PROVIDER_ACCOUNT))
    await userEvent.click(canvas.getByRole('button', { name: 'Retry' }))

    await waitForForm(canvas)
    expect(field(canvas, 'Email')).toHaveValue(PROVIDER_ACCOUNT.email)
  },
}
