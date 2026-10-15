import type { Meta, StoryObj } from '@storybook/react-webpack5'
import { expect, fn, userEvent, within } from 'storybook/test'
import { BACKUP_CODES, TOTP_URL, VALID_CODE, mfaMocks } from '#/endpoints/mfa.mocks'
import { seedEnvStore } from '#/envStore.mocks'
import { queryClientDecorator } from '#/query/queryClient.mocks'
import MFAModals from './mfaModals'

const meta: Meta<typeof MFAModals> = {
  title: 'Features/MfaModals',
  component: MFAModals,
  tags: ['!autodocs'],
  parameters: {
    msw: { handlers: mfaMocks([]) },
    a11y: { disable: true },
  },
  args: { onModalClose: fn() },
  beforeEach: seedEnvStore({ mfa_code_length: 6, mfa_localized_help_text: '<p>Ask your administrator.</p>' }),
  decorators: [queryClientDecorator],
}

export default meta
type Story = StoryObj<typeof MFAModals>

/** Types a code into the step currently showing and presses on */
async function submitCode(canvas: ReturnType<typeof within>, code: string) {
  await userEvent.type(await canvas.findByRole('textbox'), code)
  await userEvent.click(canvas.getByRole('button', { name: 'Next' }))
}

/** Turning 2FA on */
export const ConfirmNewSetup: Story = {
  args: { modalType: 'qr', qrCode: TOTP_URL },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)

    await submitCode(canvas, VALID_CODE)

    for (const code of BACKUP_CODES) {
      expect(await canvas.findByText(code)).toBeInTheDocument()
    }
    // Nothing may close this step before the codes have been downloaded
    expect(canvas.getByRole('button', { name: 'I saved my codes' })).toBeDisabled()
    expect(args.onModalClose).not.toHaveBeenCalled()
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

export const DeactivateRejectsBadCode: Story = {
  args: { modalType: 'deactivate' },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)

    await submitCode(canvas, '000000')

    expect(await canvas.findByText('Incorrect token')).toBeInTheDocument()
    expect(args.onModalClose).not.toHaveBeenCalled()
  },
}
