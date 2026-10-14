import type { Meta, StoryObj } from '@storybook/react-webpack5'
import { expect, fn, waitFor, within } from 'storybook/test'
import { UsageLimitTypes } from '#/account/stripe.types'
import languageDetailMock from '#/endpoints/languageDetail.mocks'
import languagesMock from '#/endpoints/languages.mocks'
import organizationServiceUsageMock from '#/endpoints/organizationServiceUsage.mocks'
import envStore from '#/envStore'
import { queryClientDecorator } from '#/query/queryClient.mocks'
import StepSelectLanguage from './StepSelectLanguage'

/** The class `Button` carries while `isPending`. */
const PENDING_CLASS = 'k-button--pending'

/**
 * The step where the user picks the source language and then chooses between transcribing manually and
 * automatically. Whether the automatic option is possible at all is decided by the tab that renders this
 * step, so here it arrives as props.
 */
const meta: Meta<typeof StepSelectLanguage> = {
  title: 'Components/StepSelectLanguage',
  component: StepSelectLanguage,
  decorators: [queryClientDecorator],
  parameters: {
    msw: {
      handlers: [languagesMock, languageDetailMock, organizationServiceUsageMock()],
    },
    a11y: { disable: true },
  },
  // We need `asr_mt_features_enabled` from `/environment`
  beforeEach: async () => {
    await waitFor(() => expect(envStore.isReady).toBe(true))
  },
  args: {
    onBack: fn(),
    onNext: fn(),
    onLimitExceeded: fn(),
    setLanguageCode: fn(),
    usageType: UsageLimitTypes.TRANSCRIPTION,
    // Language is preselected for all stories
    languageCode: 'en',
    suggestedLanguages: [],
    titleOverride: 'Please select the original language of the audio',
    singleManualButtonLabel: 'transcribe',
    disableAutomatic: false,
  },
}

export default meta

type Story = StoryObj<typeof StepSelectLanguage>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // The button enables itself only after it confirms the language has a transcription service.
    await waitFor(() => expect(canvas.getByRole('button', { name: 'automatic' })).toBeEnabled())
    await expect(canvas.getByRole('button', { name: 'manual' })).toBeEnabled()
    await expect(canvas.queryByText(/can't be auto-transcribed/)).toBeNull()
  },
}

/** Audio over the length the automatic transcription can handle */
export const LongAudio: Story = {
  args: {
    showLongAudioAlert: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const automatic = canvas.getByRole('button', { name: 'automatic' })

    await expect(canvas.getByText(/Audio files over 55 minutes can't be auto-transcribed/)).toBeVisible()
    // Wait out the service check that enables it in `Default`, so this proves the warning blocks it
    await waitFor(() => expect(automatic).not.toHaveClass(PENDING_CLASS))
    await expect(automatic).toBeDisabled()
    // Manual transcription is the way forward, so it stays available
    await expect(canvas.getByRole('button', { name: 'manual' })).toBeEnabled()
  },
}

/**
 * While the audio length is still being looked up we don't know yet whether the automatic option is allowed,
 * so the button waits rather than letting a click through.
 */
export const AudioLengthPending: Story = {
  args: {
    disableAutomatic: true,
    isAutomaticPending: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const automatic = canvas.getByRole('button', { name: 'automatic' })

    await expect(automatic).toBeDisabled()
    // A spinner, so the block reads as a wait rather than a dead button.
    await expect(automatic).toHaveClass(PENDING_CLASS)
  },
}
