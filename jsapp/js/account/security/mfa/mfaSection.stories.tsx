import type { Meta, StoryObj } from '@storybook/react-webpack5'
import { expect, waitFor, within } from 'storybook/test'
import type { MfaUserMethod } from '#/account/security/mfa/mfa.api'
import { MFA_ACTIVE, mfaMocks } from '#/endpoints/mfa.mocks'
import { seedEnvStore } from '#/envStore.mocks'
import { queryClientDecorator } from '#/query/queryClient.mocks'
import { hydrateProfileStoreForStories } from '#/stores/profile.mocks'
import { formatTime } from '#/utils'
import MfaSection from './mfaSection.component'

interface MfaStoryOptions {
  /** What `user-methods` answers with; empty until 2FA has been set up once */
  methods?: MfaUserMethod[]
  isMfaEnabledOnServer?: boolean
}

/**
 * Per-story setup: the rows the endpoint answers with, plus the `/environment` setting the section reads.
 * Spelled out each time, because Storybook replaces the handler array instead of merging.
 */
function withMfa({ methods = [], isMfaEnabledOnServer = true }: MfaStoryOptions) {
  const initial = [...methods]
  const seedSettings = seedEnvStore({ mfa_enabled: isMfaEnabledOnServer })

  return {
    parameters: { msw: { handlers: mfaMocks(methods) } },
    beforeEach: async () => {
      methods.splice(0, methods.length, ...initial)
      hydrateProfileStoreForStories()
      const restoreSettings = await seedSettings()

      return () => {
        restoreSettings()
        hydrateProfileStoreForStories()
      }
    },
  }
}

const meta: Meta<typeof MfaSection> = {
  title: 'Features/MfaSection',
  component: MfaSection,
  tags: ['!autodocs'],
  parameters: { a11y: { disable: true } },
  decorators: [queryClientDecorator],
}

export default meta
type Story = StoryObj<typeof MfaSection>

export const NotSetUp: Story = {
  ...withMfa({}),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await canvas.findByText('Two-factor authentication')
    expect(canvas.getByRole('switch')).not.toBeChecked()
    expect(canvas.queryByRole('button', { name: 'Reconfigure' })).not.toBeInTheDocument()
  },
}

export const Enabled: Story = {
  ...withMfa({ methods: [MFA_ACTIVE] }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await waitFor(() => expect(canvas.getByRole('switch')).toBeChecked())
    expect(canvas.getByRole('button', { name: 'Reconfigure' })).toBeEnabled()
    expect(canvas.getByRole('button', { name: 'Generate new' })).toBeEnabled()
    expect(canvas.getByText(formatTime(MFA_ACTIVE.date_modified))).toBeInTheDocument()
  },
}

export const UnavailableOnServer: Story = {
  ...withMfa({ isMfaEnabledOnServer: false }),
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(within(canvasElement).queryByText('Two-factor authentication')).not.toBeInTheDocument())
  },
}
