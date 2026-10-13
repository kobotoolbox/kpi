import type { Meta, StoryObj } from '@storybook/react-webpack5'
import { withRouter } from 'storybook-addon-remix-react-router'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import type { ProviderAccount } from '#/api/models/providerAccount'
import { accountProvidersMock, providerAccountMock } from '#/endpoints/allauth.mocks'
import type { SocialApp } from '#/envStore'
import { seedEnvStore } from '#/envStore.mocks'
import { queryClientDecorator } from '#/query/queryClient.mocks'
import { hydrateProfileStoreForStories } from '#/stores/profile.mocks'
import SsoSection from './ssoSection.component'

const UNMANAGED_APP: SocialApp = {
  name: 'Example Organization',
  provider: 'openid_connect',
  provider_id: 'example-org',
  client_id: 'example-client-id',
  managed: false,
  domains: ['example.org'],
}

const MANAGED_APP: SocialApp = { ...UNMANAGED_APP, name: 'Managed Org', provider_id: 'managed-org', managed: true }

interface SsoStoryOptions {
  socialApps: SocialApp[]
  connected?: ProviderAccount[]
  /** The real query string to arrive with, for a story about coming back from a handshake */
  search?: string
}

/** Puts a query string on the real URL and returns the teardown that puts the old one back */
function seedLocationSearch(search: string) {
  const original = window.location.search
  const replace = (value: string) => {
    const url = new URL(window.location.href)
    url.search = value
    window.history.replaceState(window.history.state, '', url)
  }

  replace(search)
  return () => replace(original)
}

/**
 * Everything one story needs: the providers, the connections allauth reports, and the URL to start from.
 * Spelled out per story, because Storybook replaces the handler array instead of merging.
 */
function withSso({ socialApps, connected = [], search }: SsoStoryOptions) {
  const seedProviders = seedEnvStore({ social_apps: socialApps })

  return {
    parameters: { msw: { handlers: [accountProvidersMock(connected)] } },
    beforeEach: async () => {
      const restoreSearch = search === undefined ? undefined : seedLocationSearch(search)
      const restoreProviders = await seedProviders()

      return () => {
        restoreProviders()
        restoreSearch?.()
      }
    },
  }
}

const meta: Meta<typeof SsoSection> = {
  title: 'Features/SsoSection',
  component: SsoSection,
  tags: ['!autodocs'],
  parameters: { a11y: { disable: true } },
  beforeEach: () => {
    hydrateProfileStoreForStories()
    return () => hydrateProfileStoreForStories()
  },
  decorators: [withRouter, queryClientDecorator],
}

export default meta
type Story = StoryObj<typeof SsoSection>

export const NotConnected: Story = {
  ...withSso({ socialApps: [UNMANAGED_APP] }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await canvas.findByRole('button', { name: UNMANAGED_APP.name })
    expect(canvas.queryByRole('button', { name: 'Disable' })).not.toBeInTheDocument()
  },
}

/** A provider configured `is_public=False`, so `/environment` omits it. allauth still names the connection. */
export const ConnectedToHiddenProvider: Story = {
  ...withSso({
    socialApps: [],
    connected: [providerAccountMock({ providerId: 'enterprise-sso', providerName: 'Enterprise SSO' })],
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await canvas.findByText('Connected to Enterprise SSO')
  },
}

/** A managed provider deletes the password on connecting, so it warns before the handshake starts */
export const ManagedProviderWarning: Story = {
  ...withSso({ socialApps: [MANAGED_APP] }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await userEvent.click(await canvas.findByRole('button', { name: MANAGED_APP.name }))

    const modal = within(document.body)
    await modal.findByText(`Connecting with ${MANAGED_APP.name}`)
    expect(await modal.findByRole('button', { name: 'Proceed' })).toBeEnabled()
  },
}

/** Connected through a managed provider: no way out from here, since the account cannot have a password */
export const ConnectedToManagedProvider: Story = {
  ...withSso({
    socialApps: [MANAGED_APP],
    connected: [providerAccountMock({ providerId: MANAGED_APP.provider_id, providerName: 'Managed Org' })],
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await canvas.findByText('Connected to Managed Org')
    expect(canvas.queryByRole('button', { name: 'Disable' })).not.toBeInTheDocument()
  },
}

/** No providers configured and nothing connected: the section renders nothing */
export const Unavailable: Story = {
  ...withSso({ socialApps: [] }),
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(within(canvasElement).queryByText('Single-Sign On')).not.toBeInTheDocument())
  },
}

export const ConnectFailed: Story = {
  ...withSso({ socialApps: [UNMANAGED_APP], search: '?error=connected_other&error_process=connect' }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await canvas.findByText(/already connected to a different KoboToolbox account/)
    // Read once and dropped, so opening this screen again does not re-announce the same failure.
    await waitFor(() => expect(new URLSearchParams(window.location.search).has('error')).toBe(false))
  },
}
