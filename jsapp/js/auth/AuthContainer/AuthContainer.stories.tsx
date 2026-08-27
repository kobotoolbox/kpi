import { Stack, Text, Title } from '@mantine/core'
import type { Decorator } from '@storybook/react'
import type { Meta, StoryObj } from '@storybook/react-webpack5'
import { reactRouterOutlet, reactRouterParameters, withRouter } from 'storybook-addon-remix-react-router'
import { expect, userEvent, within } from 'storybook/test'
import type { AuthConfiguration } from '#/api/models/authConfiguration'
import { AuthThemeEnum } from '#/api/models/authThemeEnum'
import AuthTestRoute from '#/auth/AuthTestRoute/AuthTestRoute'
import TextInput from '#/components/common/TextInput'
import { environmentResponse, makeEnvironmentMock } from '#/endpoints/environment.mocks'
import { queryClientDecorator } from '#/query/queryClient.mocks'
import { AUTH_ROUTES, ROUTES } from '#/router/routerConstants'
import { setAnonymousSessionForStories } from '#/stores/session.mocks'
import AuthCard from './AuthCard'
import AuthContainer from './AuthContainer'

const TERMS_OF_SERVICE_URL = 'https://example.org/terms'
const PRIVACY_POLICY_URL = 'https://example.org/privacy'

/**
 * A flat blue square, inlined rather than fetched: `test-storybook` runs these stories in chromium,
 * firefox and webkit and must not depend on the network.
 */
const BACKGROUND_IMAGE_DATA_URI =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPjxyZWN0IHdpZHRoPSI0IiBoZWlnaHQ9IjQiIGZpbGw9IiMyZjVkN2MiLz48L3N2Zz4='

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
    location: { path: AUTH_ROUTES.TEST },
    routing: reactRouterOutlet({ path: ROUTES.AUTH_ROOT }, { path: 'test', element: outlet }),
  })

/** Placeholder card content. The input gives the tab-order assertions something to land on. */
const stubForm = (
  <Stack gap='md'>
    <Title order={1} size='h3'>
      Sign in
    </Title>
    <TextInput label='Email address' />
  </Stack>
)

const stubAside = (
  <Stack gap='md'>
    <Title order={2} size='h4'>
      Why sign up?
    </Title>
    <Text>Supporting content an administrator can configure for the account creation screen.</Text>
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

/** Finds the element the background and theme classes live on. */
const getFrame = (canvasElement: HTMLElement) => canvasElement.querySelector('header')?.parentElement as HTMLElement

/** The default theme, with the real (temporary) `#/auth/test` route in the outlet. */
export const TestRoute: Story = {
  parameters: { reactRouter: authRouting(<AuthTestRoute />) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // `findBy…`, because the logo, the language pill and the footer links all wait on `/environment`;
    // once the logo is in, the rest of the config has landed too.
    const logo = await canvas.findByRole('img', { name: 'KoboToolbox' })
    expect(logo).toHaveAttribute('src', expect.stringContaining('kobo-logo-gray'))
    expect(canvas.getByRole('link', { name: 'KoboToolbox' })).toHaveAttribute('href', '/')

    // The pill only shows a two letter language code, so match on its accessible name instead.
    const languageToggle = canvas.getByRole('button', { name: /interface language/i })
    expect(languageToggle).toBeVisible()

    expect(canvas.getByRole('heading', { name: 'Authentication container' })).toBeVisible()

    expect(canvas.getByRole('link', { name: 'Terms of Service' })).toHaveAttribute('href', TERMS_OF_SERVICE_URL)
    expect(canvas.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', PRIVACY_POLICY_URL)

    // Keyboard order comes straight from DOM order. Nothing in the stub card is focusable, so this
    // walks header then footer; `TwoColumns` covers focus stopping inside the card on the way through.
    await userEvent.tab()
    expect(canvas.getByRole('link', { name: 'KoboToolbox' })).toHaveFocus()
    await userEvent.tab()
    expect(languageToggle).toHaveFocus()
    await userEvent.tab()
    expect(canvas.getByRole('link', { name: 'Terms of Service' })).toHaveFocus()
    await userEvent.tab()
    expect(canvas.getByRole('link', { name: 'Privacy Policy' })).toHaveFocus()
  },
}

/** A wide card with supporting content beside the form, split by a vertical divider. */
export const TwoColumns: Story = {
  parameters: { reactRouter: authRouting(<AuthCard aside={stubAside}>{stubForm}</AuthCard>) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    expect(canvas.getByLabelText('Email address')).toBeVisible()
    expect(canvas.getByRole('heading', { name: 'Why sign up?' })).toBeVisible()
    expect(canvas.getByRole('separator')).toBeVisible()

    // Wait for the config before tabbing: the header and footer are empty until it lands, so tabbing
    // early would count a tab order that doesn't exist yet.
    const termsLink = await canvas.findByRole('link', { name: 'Terms of Service' })

    // Focus enters the card between the header and the footer.
    await userEvent.tab()
    expect(canvas.getByRole('link', { name: 'KoboToolbox' })).toHaveFocus()
    await userEvent.tab()
    expect(canvas.getByRole('button', { name: /interface language/i })).toHaveFocus()
    await userEvent.tab()
    expect(canvas.getByLabelText('Email address')).toHaveFocus()
    await userEvent.tab()
    expect(termsLink).toHaveFocus()
  },
}

/**
 * The same card at phone width: it stacks, drops the divider, and gives up most of its horizontal
 * padding. All three come from container queries on the card's own width rather than the viewport,
 * which is what makes them assertable here.
 */
export const TwoColumnsStacked: Story = {
  parameters: { reactRouter: authRouting(<AuthCard aside={stubAside}>{stubForm}</AuthCard>) },
  decorators: [narrowViewportDecorator],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    const card = canvasElement.querySelector('section') as HTMLElement
    expect(getComputedStyle(card).flexDirection).toBe('column')
    // `hidden: true` because `display: none` is the thing being asserted: it drops the divider out of
    // the accessibility tree, where the default role query wouldn't find it at all.
    expect(canvas.getByRole('separator', { hidden: true })).not.toBeVisible()

    // 40px of padding on each side would leave a phone almost no room for the form.
    const column = card.firstElementChild as HTMLElement
    expect(getComputedStyle(column).paddingLeft).toBe('20px')

    expect(canvas.getByLabelText('Email address')).toBeVisible()
    expect(canvas.getByRole('heading', { name: 'Why sign up?' })).toBeVisible()
  },
}

/** An administrator uploaded a login background, which switches the whole frame to light-on-dark. */
export const CustomTheme: Story = {
  parameters: {
    msw: {
      handlers: [
        makeAuthConfigurationMock({
          theme: AuthThemeEnum.custom,
          background_image_url: BACKGROUND_IMAGE_DATA_URI,
        }),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    const logo = await canvas.findByRole('img', { name: 'KoboToolbox' })
    await expect(logo).toHaveAttribute('src', expect.stringContaining('kobologo'))

    const frame = getFrame(canvasElement)
    expect(frame.className).toContain('background--custom')
    expect(frame.style.backgroundImage).toContain(BACKGROUND_IMAGE_DATA_URI)

    const termsLink = canvas.getByRole('link', { name: 'Terms of Service' })
    expect(termsLink.parentElement?.className).toContain('footer--custom')
    expect(getComputedStyle(termsLink).color).toBe('rgb(255, 255, 255)')
  },
}

/** Servers can hide our branding (`SHOW_KOBOTOOLBOX_LOGO`); everything else stays put. */
export const NoKoboLogo: Story = {
  parameters: { msw: { handlers: [makeAuthConfigurationMock({ show_kobotoolbox_logo: false })] } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // The language selector needs `/environment` too, so its arrival means the config has landed and
    // the missing logo is a real absence rather than a slow request.
    const languageToggle = await canvas.findByRole('button', { name: /interface language/i })
    expect(languageToggle).toBeVisible()
    expect(canvas.queryByRole('link', { name: 'KoboToolbox' })).not.toBeInTheDocument()
  },
}

/** Neither legal document is configured, so the footer stays empty rather than linking nowhere. */
export const NoFooterLinks: Story = {
  parameters: {
    msw: { handlers: [makeEnvironmentMock({ terms_of_service_url: null, privacy_policy_url: null })] },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await canvas.findByRole('img', { name: 'KoboToolbox' })

    const footer = canvasElement.querySelector('footer') as HTMLElement
    expect(footer.querySelectorAll('a')).toHaveLength(0)
  },
}
