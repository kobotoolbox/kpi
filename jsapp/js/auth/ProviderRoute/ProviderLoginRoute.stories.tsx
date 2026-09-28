import type { Meta, StoryObj } from '@storybook/react-webpack5'
import type { RequestHandler } from 'msw'
import { getWorker } from 'msw-storybook-addon'
import { reactRouterOutlet, reactRouterParameters, withRouter } from 'storybook-addon-remix-react-router'
import { expect, userEvent, within } from 'storybook/test'
import { AuthThemeEnum } from '#/api/models/authThemeEnum'
import AuthContainer from '#/auth/AuthContainer/AuthContainer'
import { setLoginBackgroundMetaForStories } from '#/auth/AuthContainer/authContainer.mocks'
// The same stand-in photo the container's own stories use, so the custom theme stays offline.
import backgroundImageUrl from '#/auth/AuthContainer/salah-darwish-story-bg.webp'
import { narrowViewportDecorator } from '#/auth/authStoryHelpers'
import { makeAuthConfigurationMock, makeEnvironmentMock } from '#/endpoints/environment.mocks'
import {
  makeSocialAppMock,
  socialAppNeverAnswersMock,
  socialAppNotFoundMock,
  socialAppServerErrorMock,
} from '#/endpoints/socialApp.mocks'
import { queryClientDecorator } from '#/query/queryClient.mocks'
import { AUTH_ROUTES, ROUTES } from '#/router/routerConstants'
import { setAnonymousProfileForStories } from '#/stores/profile.mocks'
import ProviderLoginRoute from './ProviderLoginRoute'

/**
 * The screen a single sign-on link lands on, in `AuthContainer`'s outlet where it really lives - hence the
 * container, not the route, as the story component.
 *
 * Nothing here submits: the button is a real form POST to allauth, which would take the browser to the
 * provider and out of Storybook. So the stories check that the form is addressed correctly instead.
 */

/** The `provider_id` in the URL, as an instance would hand it out. */
const PROVIDER_ID = 'example-org'
const PROVIDER_NAME = 'Example Organization'

const environmentMock = makeEnvironmentMock()

/**
 * Storybook replaces the handler array rather than merging it, so a story overriding the provider lookup
 * still has to restate `/environment`, which the frame's logo and footer come from.
 */
const storyHandlers = (options?: { environment?: RequestHandler; socialApp?: RequestHandler }): RequestHandler[] => [
  options?.environment ?? environmentMock,
  options?.socialApp ?? makeSocialAppMock({ provider_id: PROVIDER_ID, name: PROVIDER_NAME }),
]

/** Renders the story as `/accounts/provider/:providerId/login`, so the route really reads its id off the URL. */
const providerLoginRouting = (providerId: string) =>
  reactRouterParameters({
    location: { path: `${ROUTES.ACCOUNTS_ROOT}/provider/${providerId}/login` },
    routing: reactRouterOutlet(
      { path: ROUTES.ACCOUNTS_ROOT },
      { path: 'provider/:providerId/login', element: <ProviderLoginRoute /> },
    ),
  })

const meta: Meta<typeof AuthContainer> = {
  title: 'Features/ProviderLoginRoute',
  component: AuthContainer,
  // Docs view can't render a full page frame usefully
  tags: ['!autodocs'],
  parameters: {
    layout: 'fullscreen',
    msw: { handlers: storyHandlers() },
    reactRouter: providerLoginRouting(PROVIDER_ID),
  },
  // Nobody is logged in when they are about to log in.
  beforeEach: setAnonymousProfileForStories,
  decorators: [withRouter, queryClientDecorator],
}

export default meta
type Story = StoryObj<typeof AuthContainer>

/** The provider resolved: its name is in the copy, and the button is ready to hand the browser over. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await canvas.findByRole('heading', { level: 1, name: `Log in with ${PROVIDER_NAME}` })
    await canvas.findByText(`Log in to KoboToolbox with your ${PROVIDER_NAME} account`)

    // Where the click goes, which is the whole point of the screen and shows nowhere on it: a real POST to
    // allauth carrying this provider and the callback that comes back to form two.
    const form = canvas.getByRole('button', { name: 'Log in' }).closest('form')
    expect(form).toHaveAttribute('action', '/api/v2/allauth/browser/v1/auth/provider/redirect')
    expect(form).toHaveAttribute('method', 'post')
    expect(form?.querySelector('input[name="provider"]')).toHaveValue(PROVIDER_ID)
    expect(form?.querySelector('input[name="process"]')).toHaveValue('login')
    expect(form?.querySelector('input[name="callback_url"]')).toHaveValue(
      `${window.location.origin}/#${AUTH_ROUTES.PROVIDER_SIGNUP}`,
    )

    // The way out for someone who followed the link by mistake.
    expect(canvas.getByRole('link', { name: 'Go back' })).toHaveAttribute('href', AUTH_ROUTES.LOGIN)
  },
}

/** A provider whose name is not the one in the URL, so the copy is demonstrably the server's answer. */
export const DifferentProvider: Story = {
  parameters: {
    reactRouter: providerLoginRouting('gitlab'),
    msw: {
      handlers: storyHandlers({ socialApp: makeSocialAppMock({ provider_id: 'gitlab', name: 'GitLab' }) }),
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await canvas.findByRole('heading', { level: 1, name: 'Log in with GitLab' })

    const form = canvas.getByRole('button', { name: 'Log in' }).closest('form')
    expect(form?.querySelector('input[name="provider"]')).toHaveValue('gitlab')
  },
}

/** While the lookup is in flight there is no name to show, so the card says what it is doing. */
export const LookingUpProvider: Story = {
  parameters: { msw: { handlers: storyHandlers({ socialApp: socialAppNeverAnswersMock() }) } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await canvas.findByText('One moment, we are looking up your login provider…')
    // Nothing to log in with yet: a button before the name would be a button to nowhere.
    expect(canvas.queryByRole('button', { name: 'Log in' })).not.toBeInTheDocument()
  },
}

/** A link whose `provider_id` no configured provider answers to. */
export const ProviderNotFound: Story = {
  parameters: { msw: { handlers: storyHandlers({ socialApp: socialAppNotFoundMock() }) } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await canvas.findByRole('heading', { level: 1, name: 'Login provider not found' })
    // No handshake offered for a provider that does not exist.
    expect(canvas.queryByRole('button', { name: 'Log in' })).not.toBeInTheDocument()
    expect(canvas.getByRole('link', { name: 'Back to login' })).toHaveAttribute('href', AUTH_ROUTES.LOGIN)
  },
}

/** A broken lookup is not a missing provider, so this offers a retry - and the retry brings the screen back. */
export const LookupError: Story = {
  parameters: { msw: { handlers: storyHandlers({ socialApp: socialAppServerErrorMock() }) } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await canvas.findByRole('heading', { level: 1, name: 'Something went wrong' })
    // Deliberately not "not found": a 500 says nothing about whether this provider is configured.
    expect(canvas.queryByRole('heading', { name: 'Login provider not found' })).not.toBeInTheDocument()

    // Put the endpoint back on its feet first, so the click has something to succeed with. The addon resets
    // runtime handlers between stories, so this stays inside this one.
    getWorker().use(makeSocialAppMock({ provider_id: PROVIDER_ID, name: PROVIDER_NAME }))
    await userEvent.click(canvas.getByRole('button', { name: 'Retry' }))

    await canvas.findByRole('heading', { level: 1, name: `Log in with ${PROVIDER_NAME}` })
  },
}

/** The same card on a narrow screen, where the buttons have the width to themselves. */
export const NarrowViewport: Story = {
  decorators: [narrowViewportDecorator],
  play: async ({ canvasElement }) => {
    await within(canvasElement).findByRole('heading', { level: 1, name: `Log in with ${PROVIDER_NAME}` })
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
    await within(canvasElement).findByRole('heading', { level: 1, name: `Log in with ${PROVIDER_NAME}` })
  },
}
