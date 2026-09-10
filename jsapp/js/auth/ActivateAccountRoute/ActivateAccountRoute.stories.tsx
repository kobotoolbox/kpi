import type { Meta, StoryObj } from '@storybook/react-webpack5'
import { reactRouterOutlet, reactRouterParameters, withRouter } from 'storybook-addon-remix-react-router'
import { userEvent, within } from 'storybook/test'
import AuthContainer from '#/auth/AuthContainer/AuthContainer'
import {
  emailVerificationInfoMock,
  emailVerificationInvalidKeyMock,
  emailVerificationServerErrorMock,
  emailVerifyConfirmMock,
  emailVerifyConfirmWithoutSessionMock,
} from '#/endpoints/allauth.mocks'
import { queryClientDecorator } from '#/query/queryClient.mocks'
import { ROUTES } from '#/router/routerConstants'
import { setAnonymousSessionForStories } from '#/stores/session.mocks'
import ActivateAccountRoute from './ActivateAccountRoute'

/**
 * Where the activation link in the sign up email will land.
 *
 * Every panel here waits on a mocked response, so Chromatic sees what it has to see, rather than a loading state.
 */

const EMAIL = 'caroline.herschel@kbtdev.org'
const USERNAME = 'caroline_herschel'

/** Renders the story as `/auth/activate/:key`, so the route really reads its key off the URL. */
const activationRouting = (key: string) =>
  reactRouterParameters({
    location: { path: `${ROUTES.AUTH_ROOT}/activate/${key}` },
    routing: reactRouterOutlet(
      { path: ROUTES.AUTH_ROOT },
      { path: 'activate/:key', element: <ActivateAccountRoute /> },
    ),
  })

const meta: Meta<typeof AuthContainer> = {
  title: 'Features/ActivateAccountRoute',
  component: AuthContainer,
  // Docs view can't render a full page frame usefully
  tags: ['!autodocs'],
  parameters: {
    layout: 'fullscreen',
    msw: { handlers: [emailVerificationInfoMock(EMAIL, USERNAME)] },
    reactRouter: activationRouting('a-good-key'),
  },
  beforeEach: setAnonymousSessionForStories,
  decorators: [withRouter, queryClientDecorator],
}

export default meta
type Story = StoryObj<typeof AuthContainer>

/** A good key: nothing is activated until the confirm click. */
export const ConfirmPrompt: Story = {
  play: async ({ canvasElement }) => {
    await within(canvasElement).findByText(/Please confirm that/)
  },
}

/** After that click, with `ACCOUNT_LOGIN_ON_EMAIL_CONFIRMATION` on: signed in and ready to go. */
export const Confirmed: Story = {
  parameters: {
    msw: { handlers: [emailVerificationInfoMock(EMAIL, USERNAME), emailVerifyConfirmMock()] },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await userEvent.click(await canvas.findByRole('button', { name: 'Confirm' }))
    await canvas.findByRole('heading', { level: 1, name: 'Email address confirmed' })
    // The button is what separates the two confirmed endings - the heading is the same on both.
    await canvas.findByRole('link', { name: 'Continue to KoboToolbox' })
  },
}

/**
 * The same click with that setting off: a 401 that allauth's own documentation calls a success, so this
 * ends on "Log in" rather than on the failure screen.
 */
export const ConfirmedWithoutSession: Story = {
  parameters: {
    msw: {
      handlers: [emailVerificationInfoMock(EMAIL, USERNAME), emailVerifyConfirmWithoutSessionMock()],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await userEvent.click(await canvas.findByRole('button', { name: 'Confirm' }))
    await canvas.findByRole('heading', { level: 1, name: 'Email address confirmed' })
    await canvas.findByRole('link', { name: 'Log in' })
  },
}

/** A link that has expired or was already used. */
export const InvalidKey: Story = {
  parameters: { msw: { handlers: [emailVerificationInvalidKeyMock()] } },
  play: async ({ canvasElement }) => {
    await within(canvasElement).findByRole('heading', { level: 1, name: 'Activation Failed' })
  },
}

/** The lookup broke rather than the key: a retry, not the failure screen. */
export const LinkCheckFailed: Story = {
  parameters: { msw: { handlers: [emailVerificationServerErrorMock()] } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await canvas.findByRole('heading', { level: 1, name: 'Something went wrong' })
    await canvas.findByRole('button', { name: 'Retry' })
  },
}

/** And the retry gets a link that was fine all along to its prompt, with no page reload. */
export const LinkCheckRetrySucceeds: Story = {
  parameters: {
    // Order matters: the `once` failure answers the first lookup, the plain mock answers the retry.
    msw: { handlers: [emailVerificationServerErrorMock({ once: true }), emailVerificationInfoMock(EMAIL, USERNAME)] },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await userEvent.click(await canvas.findByRole('button', { name: 'Retry' }))
    await canvas.findByText(/Please confirm that/)
  },
}
