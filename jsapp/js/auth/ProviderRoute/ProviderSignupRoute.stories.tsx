import type { Meta, StoryObj } from '@storybook/react-webpack5'
import type { RequestHandler } from 'msw'
import { reactRouterOutlet, reactRouterParameters, withRouter } from 'storybook-addon-remix-react-router'
import { expect, fn, userEvent, within } from 'storybook/test'
import AuthContainer from '#/auth/AuthContainer/AuthContainer'
import { type Canvas, field } from '#/auth/authStoryHelpers'
import {
  providerSignupAuthenticatedMock,
  providerSignupErrorsMock,
  providerSignupFlowExpiredMock,
  providerSignupNeverAnswersMock,
  providerSignupPendingMock,
  providerSignupPendingVerificationMock,
  sessionAnonymousMock,
} from '#/endpoints/allauth.mocks'
import { makeEnvironmentMock } from '#/endpoints/environment.mocks'
import { queryClientDecorator } from '#/query/queryClient.mocks'
import { AUTH_ROUTES, ROUTES } from '#/router/routerConstants'
import { setAnonymousProfileForStories } from '#/stores/profile.mocks'
import ProviderSignupRoute from './ProviderSignupRoute'

/**
 * The screen a single sign-on handshake comes back to, in `AuthContainer`'s outlet where it really lives -
 * hence the container, not the route, as the story component.
 *
 * Every story starts from a pending provider signup; what varies is the answer to submitting it.
 */

/** What the provider handed over, which is what the form starts filled in with. */
const PROVIDER_ACCOUNT = {
  display: 'Sally Ride',
  email: 'sallyride@nasa.com',
  username: 'sallyride',
  providerName: 'Example Organization',
}

/** Both legal documents configured - the KoboToolbox default, so there is an agreement to tick. */
const environmentMock = makeEnvironmentMock({
  terms_of_service_url: 'https://kbtdev.org/terms',
  privacy_policy_url: 'https://kbtdev.org/privacy',
})

/**
 * Storybook replaces the handler array rather than merging it, so a story overriding the submit still has to
 * restate the rest. The session lookup is only reached with nothing pending; answering "nobody" keeps it off
 * the real server.
 */
const storyHandlers = (submit?: RequestHandler): RequestHandler[] =>
  [environmentMock, providerSignupPendingMock(PROVIDER_ACCOUNT), sessionAnonymousMock(), submit].filter(
    (handler): handler is RequestHandler => Boolean(handler),
  )

/** Stands in for the page load a finished signup ends with, so no story navigates Storybook away. */
const onAuthenticated = fn()

const Subject = () => <ProviderSignupRoute onAuthenticated={onAuthenticated} />

/** Renders the story as `/accounts/provider/signup`, where allauth's `callback_url` points. */
const providerSignupRouting = reactRouterParameters({
  location: { path: AUTH_ROUTES.PROVIDER_SIGNUP },
  routing: reactRouterOutlet({ path: ROUTES.ACCOUNTS_ROOT }, { path: 'provider/signup', element: <Subject /> }),
})

const meta: Meta<typeof AuthContainer> = {
  title: 'Features/ProviderSignupRoute',
  component: AuthContainer,
  // Docs view can't render a full page frame usefully
  tags: ['!autodocs'],
  parameters: {
    layout: 'fullscreen',
    msw: { handlers: storyHandlers() },
    reactRouter: providerSignupRouting,
  },
  // Nobody is logged in while their account is still being created. Returning the teardown is not optional.
  beforeEach: () => {
    onAuthenticated.mockClear()
    return setAnonymousProfileForStories()
  },
  decorators: [withRouter, queryClientDecorator],
}

export default meta
type Story = StoryObj<typeof AuthContainer>

const submit = (canvas: Canvas) => userEvent.click(canvas.getByRole('button', { name: 'Continue' }))

/** The checkbox arrives last of the two answers the form is built from, so finding it means the form is up. */
const waitForForm = (canvas: Canvas) => canvas.findByRole('checkbox', { name: /I agree with the/ })

/** Ticks the agreement and submits, which is what it takes to get past client validation. */
async function agreeAndSubmit(canvas: Canvas) {
  await userEvent.click(await waitForForm(canvas))
  await submit(canvas)
}

/** The main flow: what the provider knew is already filled in, leaving only the gaps. */
export const Default: Story = {}

/** Emptied fields, then a malformed address - neither reaches the server. */
export const ClientValidation: Story = {
  parameters: { msw: { handlers: storyHandlers(providerSignupNeverAnswersMock()) } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await waitForForm(canvas)
    // The provider filled these in, so there is something to clear before anything can be missing.
    await userEvent.clear(field(canvas, 'Email'))
    await userEvent.clear(field(canvas, 'Username'))
    await submit(canvas)

    // Both inputs and the unticked agreement. The rules themselves are unit tested in
    // `registerValidation.tests` and `authValidation.tests`.
    expect(await canvas.findAllByText('Required field')).toHaveLength(3)

    await userEvent.type(field(canvas, 'Email'), 'not-an-address')
    await submit(canvas)
    await canvas.findByText('Please enter a valid email address')
  },
}

/** A deployment that verifies provider addresses too: a 401 with a pending `verify_email` flow. */
export const SubmitPendingVerification: Story = {
  parameters: { msw: { handlers: storyHandlers(providerSignupPendingVerificationMock()) } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await agreeAndSubmit(canvas)

    // An address that came from a provider is still not a confirmed address.
    await canvas.findByRole('heading', { level: 1, name: 'Confirm your email address' })
    await canvas.findByText(PROVIDER_ACCOUNT.email)
    expect(onAuthenticated).not.toHaveBeenCalled()
  },
}

/**
 * The KPI default, `SOCIALACCOUNT_EMAIL_VERIFICATION = 'none'`: the account comes back already signed in, so
 * the card holds still while the browser leaves for the app.
 */
export const SubmitAuthenticated: Story = {
  parameters: { msw: { handlers: storyHandlers(providerSignupAuthenticatedMock()) } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await agreeAndSubmit(canvas)

    await canvas.findByRole('heading', { level: 1, name: 'Signing you in…' })
    // The real route hands this to `window.location.assign('/')` - see `ProviderSignupRouteProps`.
    expect(onAuthenticated).toHaveBeenCalledTimes(1)
  },
}

/** Both kinds of server error at once: one attributed to a field, one that belongs to no field. */
export const ServerErrors: Story = {
  parameters: {
    msw: {
      handlers: storyHandlers(
        providerSignupErrorsMock([
          { code: 'username_taken', param: 'username', message: 'A user with that username already exists.' },
          { code: 'invalid', message: 'Sign up is temporarily unavailable. Please try again in a few minutes.' },
        ]),
      ),
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await agreeAndSubmit(canvas)

    // Field error - under the input it is about. The likeliest one here: providers hand over handles that
    // are already taken on this server.
    await canvas.findByText('A user with that username already exists.')
    // General error - above the form.
    await canvas.findByText('Sign up is temporarily unavailable. Please try again in a few minutes.')
    // The form stays put with what the provider gave us, so a new username costs one field.
    expect(field(canvas, 'Username')).toHaveValue(PROVIDER_ACCOUNT.username)
  },
}

/** The flow went away under a filled in form - another tab finished it, or the session holding it expired. */
export const FlowExpiredOnSubmit: Story = {
  parameters: { msw: { handlers: storyHandlers(providerSignupFlowExpiredMock()) } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await agreeAndSubmit(canvas)

    await canvas.findByRole('heading', { level: 1, name: 'Your login attempt has expired' })
    // The form goes: there is nothing left for it to complete.
    expect(canvas.queryByLabelText(/^Email/)).not.toBeInTheDocument()
    expect(canvas.getByRole('link', { name: 'Back to login' })).toHaveAttribute('href', AUTH_ROUTES.LOGIN)
  },
}
