import { Stack, Text, Title } from '@mantine/core'
import type { Decorator } from '@storybook/react'
import type { Meta, StoryObj } from '@storybook/react-webpack5'
import { reactRouterOutlet, reactRouterParameters, withRouter } from 'storybook-addon-remix-react-router'
import { within } from 'storybook/test'
import type { AuthConfiguration } from '#/api/models/authConfiguration'
import { AuthThemeEnum } from '#/api/models/authThemeEnum'
import TextInput from '#/components/common/TextInput'
import { environmentResponse, makeEnvironmentMock } from '#/endpoints/environment.mocks'
import { queryClientDecorator } from '#/query/queryClient.mocks'
import { AUTH_ROUTES, ROUTES } from '#/router/routerConstants'
import { setAnonymousSessionForStories } from '#/stores/session.mocks'
import AuthCard from './AuthCard'
import AuthContainer from './AuthContainer'
import { setLoginBackgroundMetaForStories } from './authContainer.mocks'
// Stand-in for the photo an administrator would upload. Storybook serves it from the same origin, so
// the story tests stay offline. Photo by Salah Darwish.
import backgroundImageUrl from './salah-darwish-story-bg.webp'

const TERMS_OF_SERVICE_URL = 'https://example.org/terms'
const PRIVACY_POLICY_URL = 'https://example.org/privacy'

/** Both legal links configured, so the footer has something to show. */
const environmentMockWithFooterLinks = makeEnvironmentMock({
  terms_of_service_url: TERMS_OF_SERVICE_URL,
  privacy_policy_url: PRIVACY_POLICY_URL,
})

/** `makeEnvironmentMock` merges shallowly, so a nested override has to restate the whole object. */
const makeAuthConfigurationMock = (override: Partial<AuthConfiguration>) =>
  makeEnvironmentMock({
    terms_of_service_url: TERMS_OF_SERVICE_URL,
    privacy_policy_url: PRIVACY_POLICY_URL,
    auth_configuration: { ...environmentResponse.auth_configuration, ...override },
  })

/**
 * Renders the story as the `/auth` route with the given element in its outlet, so what you see is
 * really the routed container rather than the component in isolation.
 */
const authRouting = (outlet: React.ReactNode) =>
  reactRouterParameters({
    location: { path: AUTH_ROUTES.REGISTER },
    routing: reactRouterOutlet({ path: ROUTES.AUTH_ROOT }, { path: 'register', element: outlet }),
  })

/** Placeholder card content. The input gives the tab-order assertions something to land on. */
const stubForm = (
  <Stack gap='md'>
    <Title order={1} size='h3'>
      Sign in please
    </Title>
    <TextInput label='Email address' />
  </Stack>
)

const stubAside = (
  <Stack gap='md'>
    <Title order={2} size='h4'>
      Reptilians for life
    </Title>
    <Text>Supporting content an administrator can configure for the account creation screen.</Text>
    <Text>
      Shapeshifting reptilian aliens control Earth by taking on human form and gaining political power to manipulate
      human societies.
    </Text>
  </Stack>
)

/**
 * Narrows the card enough to trip both of its container queries - stacking and reduced padding -
 * without touching the preview viewport, which `test-storybook` can't resize.
 */
const narrowViewportDecorator: Decorator = (Story) => <div style={{ width: 400 }}>{Story()}</div>

const meta: Meta<typeof AuthContainer> = {
  title: 'Features/AuthContainer',
  component: AuthContainer,
  // Docs view can't render a full page frame usefully
  tags: ['!autodocs'],
  parameters: {
    layout: 'fullscreen',
    msw: { handlers: [environmentMockWithFooterLinks] },
    reactRouter: authRouting(<AuthCard>{stubForm}</AuthCard>),
  },
  // Nobody is logged in on a sign-in screen. Storybook runs the returned teardown, which matters:
  // `preview.tsx` forces the logged-in state before every story.
  beforeEach: setAnonymousSessionForStories,
  decorators: [withRouter, queryClientDecorator],
}

export default meta
type Story = StoryObj<typeof AuthContainer>

// NOTE: Each story below waits for `/environment` before Chromatic looks at it

/** The default theme around a single column */
export const Default: Story = {}

/** A wide card with supporting content beside the form, split by a vertical divider. */
export const TwoColumns: Story = {
  parameters: { reactRouter: authRouting(<AuthCard aside={stubAside}>{stubForm}</AuthCard>) },
}

/**
 * The same card at phone width: it stacks, drops the divider, etc. Works thanks to container query.
 */
export const TwoColumnsStacked: Story = {
  parameters: { reactRouter: authRouting(<AuthCard aside={stubAside}>{stubForm}</AuthCard>) },
  decorators: [narrowViewportDecorator],
}

/** Custom background should cause few things to appear differently */
export const CustomTheme: Story = {
  parameters: {
    msw: {
      handlers: [
        makeAuthConfigurationMock({
          theme: AuthThemeEnum.custom,
          background_image_url: backgroundImageUrl,
        }),
      ],
    },
  },
  // Mimick what django template does
  beforeEach: setLoginBackgroundMetaForStories(backgroundImageUrl),
  // The footer links come from `/environment` too, so having one means the theme has landed
  play: async ({ canvasElement }) => {
    await within(canvasElement).findByRole('link', { name: 'Terms of Service' })
  },
}

/** Config for hiding Kobo logo. */
export const NoKoboLogo: Story = {
  parameters: { msw: { handlers: [makeAuthConfigurationMock({ show_kobotoolbox_logo: false })] } },
  // The language selector needs `/environment` too, so its arrival means the missing logo is a real
  // absence rather than a slow request.
  play: async ({ canvasElement }) => {
    await within(canvasElement).findByRole('button', { name: /interface language/i })
  },
}

/** Footer is empty if neither legal URL is set. */
export const NoFooterLinks: Story = {
  parameters: {
    msw: { handlers: [makeEnvironmentMock({ terms_of_service_url: null, privacy_policy_url: null })] },
  },
  // Same idea: the logo arrives with the response, so the empty footer beside it is settled.
  play: async ({ canvasElement }) => {
    await within(canvasElement).findByRole('img', { name: 'KoboToolbox' })
  },
}
