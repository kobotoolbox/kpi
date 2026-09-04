import type { Decorator } from '@storybook/react'
import type { Meta, StoryObj } from '@storybook/react-webpack5'
import type { RequestHandler } from 'msw'
import { reactRouterOutlet, reactRouterParameters, withRouter } from 'storybook-addon-remix-react-router'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { AuthThemeEnum } from '#/api/models/authThemeEnum'
import type { SocialApp } from '#/api/models/socialApp'
import AuthContainer from '#/auth/AuthContainer/AuthContainer'
import { setLoginBackgroundMetaForStories } from '#/auth/AuthContainer/authContainer.mocks'
// The same stand-in photo the container's own stories use, so the custom theme stays offline.
import backgroundImageUrl from '#/auth/AuthContainer/salah-darwish-story-bg.webp'
import { signupErrorsMock, signupNeverAnswersMock, signupPendingVerificationMock } from '#/endpoints/allauth.mocks'
import { environmentResponse, makeEnvironmentMock } from '#/endpoints/environment.mocks'
import { queryClientDecorator } from '#/query/queryClient.mocks'
import { AUTH_ROUTES, ROUTES } from '#/router/routerConstants'
import { setAnonymousSessionForStories } from '#/stores/session.mocks'
import RegisterRoute from './RegisterRoute'

/**
 * The registration screen in `AuthContainer`'s outlet, where it really lives - hence the container, not
 * the route, as the story component.
 */

const TERMS_OF_SERVICE_URL = 'https://kbtdev.org/terms'
const PRIVACY_POLICY_URL = 'https://kbtdev.org/privacy'

/** Both legal documents configured, so the Terms of Service checkbox renders real links to wait on. */
const environmentMock = makeEnvironmentMock({
  terms_of_service_url: TERMS_OF_SERVICE_URL,
  privacy_policy_url: PRIVACY_POLICY_URL,
})

/** Both supporting fields filled in: a `login_supporting_image` upload and a `welcome_message`, as HTML. */
const supportingEnvironmentMock = makeEnvironmentMock({
  terms_of_service_url: TERMS_OF_SERVICE_URL,
  privacy_policy_url: PRIVACY_POLICY_URL,
  auth_configuration: {
    ...environmentResponse.auth_configuration,
    supporting_image_url: backgroundImageUrl,
    supporting_text: '<h2>Welcome to the Example Organization server</h2>\n<p>Accounts here are for staff.</p>',
  },
})

/** An organization that signs in through SSO and owns `kbtdev.org` addresses. */
const managedSsoApp: SocialApp = {
  provider: 'openid_connect',
  name: 'Example Organization',
  client_id: 'example-client-id',
  provider_id: 'example-org',
  managed: true,
  domains: ['kbtdev.org'],
}

/**
 * Storybook replaces the handler array rather than merging it, so a story overriding the signup handler
 * still has to restate `/environment`.
 */
const storyHandlers = (options?: { environment?: RequestHandler; signup?: RequestHandler }): RequestHandler[] =>
  [options?.environment ?? environmentMock, options?.signup].filter((handler): handler is RequestHandler =>
    Boolean(handler),
  )

/** Renders the story as `/auth/register`, so what you see is the routed screen inside its frame. */
const registerRouting = reactRouterParameters({
  location: { path: AUTH_ROUTES.REGISTER },
  routing: reactRouterOutlet({ path: ROUTES.AUTH_ROOT }, { path: 'register', element: <RegisterRoute /> }),
})

/** Narrows the card enough to trip its container query - `test-storybook` can't resize the viewport. */
const narrowViewportDecorator: Decorator = (Story) => <div style={{ width: 400 }}>{Story()}</div>

const meta: Meta<typeof AuthContainer> = {
  title: 'Features/RegisterRoute',
  component: AuthContainer,
  // Docs view can't render a full page frame usefully
  tags: ['!autodocs'],
  parameters: {
    layout: 'fullscreen',
    msw: { handlers: storyHandlers() },
    reactRouter: registerRouting,
  },
  // Nobody is logged in on a registration screen.
  beforeEach: setAnonymousSessionForStories,
  decorators: [withRouter, queryClientDecorator],
}

export default meta
type Story = StoryObj<typeof AuthContainer>

type Canvas = ReturnType<typeof within>

const VALID_INPUT = {
  name: 'Caroline Herschel',
  email: 'caroline.herschel@kbtdev.org',
  username: 'caroline_herschel',
  password: 'correct horse battery staple',
}

/**
 * Waits until `/environment` has landed, which the managed SSO check depends on. Two matches, not one:
 * the frame's footer and the Terms of Service checkbox both build a link from that same response.
 */
const waitForEnvironment = (canvas: Canvas) =>
  waitFor(() => expect(canvas.getAllByRole('link', { name: 'Terms of Service' })).toHaveLength(2))

/**
 * Finds an input by its label
 */
const field = (canvas: Canvas, label: string) => canvas.getByLabelText(new RegExp(`^${label}`))

/** Fills every field with something the client accepts. */
async function fillForm(canvas: Canvas, overrides: Partial<typeof VALID_INPUT> = {}) {
  const values = { ...VALID_INPUT, ...overrides }

  await waitForEnvironment(canvas)

  await userEvent.type(field(canvas, 'Full name'), values.name)
  await userEvent.type(field(canvas, 'Email'), values.email)
  await userEvent.type(field(canvas, 'Username'), values.username)
  await userEvent.type(field(canvas, 'Password'), values.password)
  await userEvent.type(field(canvas, 'Confirm password'), values.password)
  await userEvent.click(canvas.getByRole('checkbox', { name: /I agree with the/ }))
}

const submit = (canvas: Canvas) => userEvent.click(canvas.getByRole('button', { name: 'Continue' }))

/** No supporting content configured - one column */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    await waitForEnvironment(within(canvasElement))
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

export const CustomTheme: Story = {
  parameters: {
    msw: {
      handlers: storyHandlers({
        environment: makeEnvironmentMock({
          terms_of_service_url: TERMS_OF_SERVICE_URL,
          privacy_policy_url: PRIVACY_POLICY_URL,
          auth_configuration: {
            ...environmentResponse.auth_configuration,
            theme: AuthThemeEnum.custom,
            background_image_url: backgroundImageUrl,
          },
        }),
      }),
    },
  },
  beforeEach: setLoginBackgroundMetaForStories(backgroundImageUrl),
  play: async ({ canvasElement }) => {
    await waitForEnvironment(within(canvasElement))
  },
}

/** Nothing filled in, form submitted - fields show errors */
export const ClientValidation: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await waitForEnvironment(canvas)
    await submit(canvas)

    // The rules themselves are unit tested in `registerValidation.tests`
    expect(await canvas.findAllByText('Required field')).toHaveLength(6)
  },
}

/** Only one document configured: the checkbox asks about that one, with no mention of the other. */
export const PrivacyPolicyOnly: Story = {
  parameters: {
    msw: { handlers: storyHandlers({ environment: makeEnvironmentMock({ privacy_policy_url: PRIVACY_POLICY_URL }) }) },
  },
  play: async ({ canvasElement }) => {
    // Two matches again, for the same reason: the footer's link and the checkbox's.
    await waitFor(() => expect(within(canvasElement).getAllByRole('link', { name: 'Privacy Policy' })).toHaveLength(2))
  },
}

/** No legal documents configured - nothing to agree - no checkbox */
export const NoLegalDocuments: Story = {
  parameters: { msw: { handlers: storyHandlers({ environment: makeEnvironmentMock() }) } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // The logo comes from the same response, so the missing checkbox is a real absence rather than a
    // request still in flight.
    await canvas.findByRole('img', { name: 'KoboToolbox' })
    await submit(canvas)

    // Five where `ClientValidation` gets six: the rule has to go away with the checkbox, or nobody could
    // ever submit this form.
    expect(await canvas.findAllByText('Required field')).toHaveLength(5)
  },
}

/** An address whose domain has to sign in through SSO instead. */
export const ManagedSsoDomain: Story = {
  parameters: {
    msw: {
      handlers: storyHandlers({
        environment: makeEnvironmentMock({
          terms_of_service_url: TERMS_OF_SERVICE_URL,
          privacy_policy_url: PRIVACY_POLICY_URL,
          social_apps: [managedSsoApp],
        }),
      }),
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await fillForm(canvas, { email: 'caroline.herschel@kbtdev.org' })
    await submit(canvas)
    await canvas.findByText('Your organization has restricted the use of passwords. Please sign up using SSO instead.')
  },
}

/** The submit button holds a spinner until the server answers. */
export const SubmitForm: Story = {
  parameters: { msw: { handlers: storyHandlers({ signup: signupNeverAnswersMock() }) } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await fillForm(canvas)
    await submit(canvas)
    expect(canvas.getByRole('button', { name: 'Continue' })).toBeDisabled()
  },
}

/** The happy path on default configuration: a 401 with a pending `verify_email` flow, treated as success. */
export const SubmitPendingVerification: Story = {
  parameters: { msw: { handlers: storyHandlers({ signup: signupPendingVerificationMock() }) } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await fillForm(canvas)
    await submit(canvas)

    // A 401 is the success on a KPI default, so getting this far is the point of the story. Masking the
    // address is `maskEmail.tests`' business.
    await canvas.findByRole('heading', { level: 1, name: 'Confirm your email address' })
  },
}

/** Both kinds of server error at once: one attributed to a field, one that belongs to no field. */
export const ServerErrors: Story = {
  parameters: {
    msw: {
      handlers: storyHandlers({
        signup: signupErrorsMock([
          { code: 'username_taken', param: 'username', message: 'A user with that username already exists.' },
          { code: 'invalid', message: 'Sign up is temporarily unavailable. Please try again in a few minutes.' },
        ]),
      }),
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await fillForm(canvas)
    await submit(canvas)

    // Field error - under input
    await canvas.findByText('A user with that username already exists.')
    // General error - above the form
    await canvas.findByText('Sign up is temporarily unavailable. Please try again in a few minutes.')
  },
}

/** `registration_open` off: there is nothing to fill in. */
export const RegistrationClosed: Story = {
  parameters: {
    msw: {
      handlers: storyHandlers({
        environment: makeEnvironmentMock({
          terms_of_service_url: TERMS_OF_SERVICE_URL,
          privacy_policy_url: PRIVACY_POLICY_URL,
          registration_open: false,
        }),
      }),
    },
  },
  play: async ({ canvasElement }) => {
    // `findBy`, not `getBy`: the form shows first and swaps once `/environment` lands.
    await within(canvasElement).findByRole('heading', { level: 1, name: 'Sign up closed' })
  },
}
