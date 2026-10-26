import type { Meta, StoryObj } from '@storybook/react-webpack5'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import {
  BACKUP_CODES,
  INCORRECT_CODE_MESSAGE,
  type MfaMockState,
  TOTP_URL,
  VALID_CODE,
  VALID_PASSWORD,
  mfaActivateCounterMock,
  mfaDeactivateRefusedMock,
  mfaMocks,
  mfaRecoveryCodesServerErrorMock,
} from '#/endpoints/mfa.mocks'
import { seedEnvStore } from '#/envStore.mocks'
import { queryClientDecorator } from '#/query/queryClient.mocks'
import MFAModals from './mfaModals'

/** Shared by every story, reset before each */
const state: MfaMockState = { totp: null }
const seedSettings = seedEnvStore({ mfa_code_length: 6, mfa_localized_help_text: '<p>Ask your administrator.</p>' })

const meta: Meta<typeof MFAModals> = {
  title: 'Features/MfaModals',
  component: MFAModals,
  tags: ['!autodocs'],
  parameters: {
    msw: { handlers: mfaMocks(state) },
    a11y: { disable: true },
  },
  args: { onModalClose: fn() },
  beforeEach: async () => {
    state.totp = null
    return seedSettings()
  },
  decorators: [queryClientDecorator],
}

export default meta
type Story = StoryObj<typeof MFAModals>

type Canvas = ReturnType<typeof within>

/** Types a code into the step currently showing and presses on */
async function submitCode(canvas: Canvas, code: string) {
  await userEvent.type(await canvas.findByRole('textbox'), code)
  await userEvent.click(canvas.getByRole('button', { name: 'Next' }))
}

async function typePassword(canvas: Canvas, password: string) {
  await userEvent.type(await canvas.findByLabelText('Password'), password)
}

async function expectBackupCodes(canvas: Canvas) {
  for (const code of BACKUP_CODES) {
    expect(await canvas.findByText(code)).toBeInTheDocument()
  }
}

/** Turning 2FA on */
export const ConfirmNewSetup: Story = {
  args: { modalType: 'qr', qrCode: TOTP_URL },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)

    await typePassword(canvas, VALID_PASSWORD)
    await submitCode(canvas, VALID_CODE)

    await expectBackupCodes(canvas)
    // Nothing may close this step before the codes have been downloaded
    expect(canvas.getByRole('button', { name: 'I saved my codes' })).toBeDisabled()
    expect(args.onModalClose).not.toHaveBeenCalled()
  },
}

let activationCount = 0

/** 2FA went on but the codes didn't load, so Next only rereads them */
export const ConfirmRetriesRecoveryCodes: Story = {
  args: { modalType: 'qr', qrCode: TOTP_URL },
  parameters: {
    msw: {
      handlers: [
        mfaActivateCounterMock(() => activationCount++),
        mfaRecoveryCodesServerErrorMock({ once: true }),
        ...mfaMocks(state),
      ],
    },
  },
  beforeEach: () => {
    activationCount = 0
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await typePassword(canvas, VALID_PASSWORD)
    await submitCode(canvas, VALID_CODE)
    await waitFor(() => expect(state.totp).not.toBeNull())
    await waitFor(() => expect(canvas.getByRole('button', { name: 'Next' })).toBeEnabled())

    await userEvent.click(canvas.getByRole('button', { name: 'Next' }))

    await expectBackupCodes(canvas)
    expect(activationCount).toBe(1)
  },
}

export const ConfirmRejectsBadPassword: Story = {
  args: { modalType: 'qr', qrCode: TOTP_URL },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await typePassword(canvas, 'wrong password')
    await submitCode(canvas, VALID_CODE)

    expect(await canvas.findByText('Incorrect password.')).toBeInTheDocument()
    expect(state.totp).toBeNull()
  },
}

/** SSO-only accounts have no password, and allauth lets them through without one */
export const ConfirmWithoutPassword: Story = {
  args: { modalType: 'qr', qrCode: TOTP_URL },
  parameters: { msw: { handlers: mfaMocks(state, { hasUsablePassword: false }) } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await submitCode(canvas, VALID_CODE)

    await expectBackupCodes(canvas)
    expect(canvas.queryByLabelText('Password')).not.toBeInTheDocument()
  },
}

export const EnterKeyManually: Story = {
  args: { modalType: 'qr', qrCode: TOTP_URL },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await userEvent.click(await canvas.findByText('Enter key manually'))

    expect(await canvas.findByText('MFADEMOSECRET234')).toBeInTheDocument()
  },
}

/** Deletes the old setup, then walks on to a new one without closing */
export const ReconfigureContinuesToNewSetup: Story = {
  args: { modalType: 'reconfigure' },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)

    await userEvent.click(await canvas.findByRole('button', { name: 'Next' }))
    await submitCode(canvas, VALID_CODE)

    // The modal opened without a QR code, so this secret can only come from the new setup
    await userEvent.click(await canvas.findByText('Enter key manually'))
    expect(await canvas.findByText('MFADEMOSECRET234')).toBeInTheDocument()

    await typePassword(canvas, VALID_PASSWORD)
    await submitCode(canvas, VALID_CODE)

    await expectBackupCodes(canvas)
    expect(args.onModalClose).not.toHaveBeenCalled()
  },
}

export const DeactivateRejectsBadCode: Story = {
  args: { modalType: 'deactivate' },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)

    await submitCode(canvas, '000000')

    expect(await canvas.findByText(INCORRECT_CODE_MESSAGE)).toBeInTheDocument()
    expect(args.onModalClose).not.toHaveBeenCalled()
  },
}

export const DeactivateRefusedForSuperuser: Story = {
  args: { modalType: 'deactivate' },
  parameters: { msw: { handlers: [mfaDeactivateRefusedMock(), ...mfaMocks(state)] } },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)

    await submitCode(canvas, VALID_CODE)

    expect(await canvas.findByText('You cannot deactivate two-factor authentication.')).toBeInTheDocument()
    expect(args.onModalClose).not.toHaveBeenCalled()
  },
}
