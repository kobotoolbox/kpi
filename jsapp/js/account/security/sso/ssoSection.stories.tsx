import type { Meta, StoryObj } from '@storybook/react-webpack5'
import type { HttpHandler } from 'msw'
import { withRouter } from 'storybook-addon-remix-react-router'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import type { ProviderAccount } from '#/api/models/providerAccount'
import {
  accountProvidersDisconnectRefusedMock,
  accountProvidersMock,
  accountProvidersNeverAnswersMock,
  accountProvidersServerErrorMock,
  providerAccountMock,
} from '#/endpoints/allauth.mocks'
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
  /** What answers allauth when `connected` alone will not do: a lookup that fails, a refused disconnect. */
  handlers?: HttpHandler[]
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
function withSso({ socialApps, connected = [], search, handlers }: SsoStoryOptions) {
  const seedProviders = seedEnvStore({ social_apps: socialApps })

  return {
    parameters: { msw: { handlers: handlers ?? [accountProvidersMock(connected)] } },
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

/** Nothing is known until the lookup answers, so neither the connect buttons nor `Disable` may be offered yet */
export const LookupPending: Story = {
  ...withSso({ socialApps: [UNMANAGED_APP], handlers: [accountProvidersNeverAnswersMock()] }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await canvas.findByText('Single-Sign On')
    expect(canvas.queryByRole('button', { name: UNMANAGED_APP.name })).not.toBeInTheDocument()
    expect(canvas.queryByRole('button', { name: 'Disable' })).not.toBeInTheDocument()
  },
}

/** A failed lookup says so and offers a retry, rather than reading as "nothing connected" */
export const LookupFailed: Story = {
  // Every request fails: react-query asks twice in some browsers, and a success behind this one would win.
  ...withSso({ socialApps: [UNMANAGED_APP], handlers: [accountProvidersServerErrorMock()] }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await canvas.findByText(/could not check whether your account is connected/)
    expect(canvas.queryByRole('button', { name: UNMANAGED_APP.name })).not.toBeInTheDocument()
  },
}

/** A refused disconnect, said in our words: set a password first */
export const DisconnectRefused: Story = {
  ...withSso({
    socialApps: [UNMANAGED_APP],
    handlers: [
      accountProvidersMock([providerAccountMock({ providerId: UNMANAGED_APP.provider_id })]),
      accountProvidersDisconnectRefusedMock('no_password'),
    ],
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await userEvent.click(await canvas.findByRole('button', { name: 'Disable' }))

    await canvas.findByText(/Set a password in the Password section above first/)
    // The connection is still there, so `Disable` stays.
    expect(canvas.getByText(`Connected to ${UNMANAGED_APP.name}`)).toBeInTheDocument()
    expect(canvas.getByRole('button', { name: 'Disable' })).toBeEnabled()
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
