import type { Meta, StoryObj } from '@storybook/react-webpack5'
import { expect, waitFor, within } from 'storybook/test'
import type { TOTPAuthenticator } from '#/api/models/tOTPAuthenticator'
import { MFA_ACTIVE, MFA_ACTIVE_CREATED_AT, type MfaMockState, mfaMocks } from '#/endpoints/mfa.mocks'
import { seedEnvStore } from '#/envStore.mocks'
import { queryClientDecorator } from '#/query/queryClient.mocks'
import { hydrateProfileStoreForStories } from '#/stores/profile.mocks'
import { formatTime } from '#/utils'
import MfaSection from './mfaSection.component'

interface MfaStoryOptions {
  /** The authenticator allauth reports, `null` while 2FA is off */
  totp?: TOTPAuthenticator | null
  isMfaEnabledOnServer?: boolean
}

/**
 * Per-story setup: the authenticator allauth answers with, plus the `/environment` setting the section reads.
 * Spelled out each time, because Storybook replaces the handler array instead of merging.
 */
function withMfa({ totp = null, isMfaEnabledOnServer = true }: MfaStoryOptions) {
  const state: MfaMockState = { totp }
  const seedSettings = seedEnvStore({ mfa_enabled: isMfaEnabledOnServer })

  return {
    parameters: { msw: { handlers: mfaMocks(state) } },
    beforeEach: async () => {
      state.totp = totp
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
  ...withMfa({ totp: MFA_ACTIVE }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await waitFor(() => expect(canvas.getByRole('switch')).toBeChecked())
    expect(canvas.getByRole('button', { name: 'Reconfigure' })).toBeEnabled()
    expect(canvas.getByRole('button', { name: 'Generate new' })).toBeEnabled()
    expect(canvas.getByText(formatTime(MFA_ACTIVE_CREATED_AT))).toBeInTheDocument()
  },
}

export const UnavailableOnServer: Story = {
  ...withMfa({ isMfaEnabledOnServer: false }),
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(within(canvasElement).queryByText('Two-factor authentication')).not.toBeInTheDocument())
  },
}
