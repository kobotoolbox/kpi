import type { Meta, StoryObj } from '@storybook/react-webpack5'
import { toast } from 'react-hot-toast'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import type { Canvas } from '#/auth/authStoryHelpers'
import Modal from '#/components/common/modal'
import {
  BACKUP_CODES,
  INCORRECT_CODE_MESSAGE,
  type MfaMockState,
  TOTP_URL,
  VALID_CODE,
  VALID_PASSWORD,
  mfaDeactivateRefusedMock,
  mfaMocks,
  mfaPostCounterMock,
  mfaRecoveryCodesServerErrorMock,
} from '#/endpoints/mfa.mocks'
import { seedEnvStore } from '#/envStore.mocks'
import { queryClientDecorator } from '#/query/queryClient.mocks'
import ToasterConfig from '#/toasterConfig'
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
    // Toasts outlive a story, and one story checks there are none
    toast.remove()
    return seedSettings()
  },
  decorators: [
    (Story) => (
      <>
        <ToasterConfig />
        {/* `BigModal`'s frame, so each step shows at its real size */}
        <Modal
          open
          onClose={() => {}}
          title='Two-factor authentication'
          className='modal--custom-header modal--mfa-setup'
        >
          <Modal.Body>
            <Story />
          </Modal.Body>
        </Modal>
      </>
    ),
    queryClientDecorator,
  ],
}

export default meta
type Story = StoryObj<typeof MFAModals>

/** Types a code into the step currently showing and presses on */
async function submitCode(canvas: Canvas, code: string) {
  await userEvent.type(await canvas.findByRole('textbox'), code)
  await userEvent.click(canvas.getByRole('button', { name: 'Next' }))
}

async function typePassword(canvas: Canvas, password: string) {
  await userEvent.type(await canvas.findByLabelText('Password'), password)
}

/** Turning 2FA off takes the password as well as the code */
async function submitTurnOff(canvas: Canvas, code: string, password = VALID_PASSWORD) {
  await typePassword(canvas, password)
  await submitCode(canvas, code)
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
let reauthenticationCount = 0

/** 2FA went on but the codes didn't load. The retry takes a new token and never activates twice */
export const ConfirmRetriesRecoveryCodes: Story = {
  args: { modalType: 'qr', qrCode: TOTP_URL },
  parameters: {
    msw: {
      handlers: [
        mfaPostCounterMock('activate', () => activationCount++),
        mfaPostCounterMock('mfaReauthenticate', () => reauthenticationCount++),
        mfaRecoveryCodesServerErrorMock({ once: true }),
        ...mfaMocks(state),
      ],
    },
  },
  beforeEach: () => {
    activationCount = 0
    reauthenticationCount = 0
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await typePassword(canvas, VALID_PASSWORD)
    await submitCode(canvas, VALID_CODE)
    expect(await canvas.findByText(/Enter a new token to see your recovery codes/)).toBeInTheDocument()
    expect(state.totp).not.toBeNull()
    expect(canvas.queryByLabelText('Password')).not.toBeInTheDocument()
    expect(canvas.getByRole('button', { name: 'Next' })).toBeDisabled()

    await submitCode(canvas, VALID_CODE)

    await expectBackupCodes(canvas)
    expect(activationCount).toBe(1)
    expect(reauthenticationCount).toBe(1)
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

    // A new attempt clears it
    await typePassword(canvas, 'x')
    expect(canvas.queryByText('Incorrect password.')).not.toBeInTheDocument()
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
    await submitTurnOff(canvas, VALID_CODE)

    // The modal opened without a QR code, so this secret can only come from the new setup
    await userEvent.click(await canvas.findByText('Enter key manually'))
    expect(await canvas.findByText('MFADEMOSECRET234')).toBeInTheDocument()

    await typePassword(canvas, VALID_PASSWORD)
    await submitCode(canvas, VALID_CODE)

    await expectBackupCodes(canvas)
    expect(args.onModalClose).not.toHaveBeenCalled()
  },
}

/** SSO-only accounts have no password, so the code alone does it */
export const DeactivateWithoutPassword: Story = {
  args: { modalType: 'deactivate' },
  parameters: { msw: { handlers: mfaMocks(state, { hasUsablePassword: false }) } },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)

    await submitCode(canvas, VALID_CODE)

    await waitFor(() => expect(args.onModalClose).toHaveBeenCalled())
    expect(canvas.queryByLabelText('Password')).not.toBeInTheDocument()
  },
}

/** Regenerating keeps allauth's rule: the code alone */
export const RegenerateWithoutPassword: Story = {
  args: { modalType: 'regenerate' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await userEvent.click(await canvas.findByRole('button', { name: 'Next' }))
    expect(canvas.queryByLabelText('Password')).not.toBeInTheDocument()
    await submitCode(canvas, VALID_CODE)

    await expectBackupCodes(canvas)
  },
}

/** Turning 2FA off takes both, and each refusal shows by its own field */
export const DeactivateWithPasswordAndCode: Story = {
  args: { modalType: 'deactivate' },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const next = () => userEvent.click(canvas.getByRole('button', { name: 'Next' }))
    const code = await canvas.findByRole('textbox')

    // Nothing to press until both are in
    await userEvent.type(code, '000000')
    expect(canvas.getByRole('button', { name: 'Next' })).toBeDisabled()

    await typePassword(canvas, 'wrong password')
    await next()
    expect(await canvas.findByText('Incorrect password.')).toBeInTheDocument()

    // Every submit empties the code field
    const password = canvas.getByLabelText('Password')
    await userEvent.clear(password)
    await userEvent.type(password, VALID_PASSWORD)
    await userEvent.type(code, '000000')
    await next()
    // By the field only, no toast
    expect(await canvas.findAllByText(INCORRECT_CODE_MESSAGE)).toHaveLength(1)
    expect(args.onModalClose).not.toHaveBeenCalled()

    // A new attempt clears it
    await userEvent.type(code, VALID_CODE)
    expect(canvas.queryByText(INCORRECT_CODE_MESSAGE)).not.toBeInTheDocument()
    await next()

    await waitFor(() => expect(args.onModalClose).toHaveBeenCalled())
  },
}

export const DeactivateRefusedForSuperuser: Story = {
  args: { modalType: 'deactivate' },
  parameters: { msw: { handlers: [mfaDeactivateRefusedMock(), ...mfaMocks(state)] } },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)

    await submitTurnOff(canvas, VALID_CODE)

    expect(await canvas.findByText('You cannot deactivate two-factor authentication.')).toBeInTheDocument()
    expect(args.onModalClose).not.toHaveBeenCalled()
  },
}
