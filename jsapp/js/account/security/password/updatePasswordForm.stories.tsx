import type { Meta, StoryObj } from '@storybook/react-webpack5'
import { toast } from 'react-hot-toast'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import type { Canvas } from '#/auth/authStoryHelpers'
import { mePasswordChangeMock } from '#/endpoints/me.mocks'
import { INCORRECT_CODE_MESSAGE, MFA_ACTIVE, VALID_CODE, mfaAuthenticatorsMock } from '#/endpoints/mfa.mocks'
import { seedEnvStore } from '#/envStore.mocks'
import { queryClientDecorator } from '#/query/queryClient.mocks'
import ToasterConfig from '#/toasterConfig'
import UpdatePasswordForm from './updatePasswordForm.component'

const CODE_LABEL = 'Two-factor authentication code'
const seedSettings = seedEnvStore({})

const meta: Meta<typeof UpdatePasswordForm> = {
  title: 'Features/UpdatePasswordForm',
  component: UpdatePasswordForm,
  tags: ['!autodocs'],
  parameters: { a11y: { disable: true } },
  args: { onSuccess: fn() },
  beforeEach: async () => {
    toast.remove()
    return seedSettings()
  },
  decorators: [
    (Story) => (
      <>
        <ToasterConfig />
        <Story />
      </>
    ),
    queryClientDecorator,
  ],
}

export default meta
type Story = StoryObj<typeof UpdatePasswordForm>

async function fillPasswords(canvas: Canvas) {
  await userEvent.type(await canvas.findByLabelText('Current Password'), 'old password')
  await userEvent.type(canvas.getByLabelText('New Password'), 'new password')
  await userEvent.type(canvas.getByLabelText('Verify Password'), 'new password')
}

const save = (canvas: Canvas) => userEvent.click(canvas.getByRole('button', { name: 'Save Password' }))

/** With 2FA on, the backend wants a code as well as the current password; the flag shows the field upfront */
export const WithMfaAsksForCode: Story = {
  parameters: {
    msw: { handlers: [mfaAuthenticatorsMock({ totp: MFA_ACTIVE }), mePasswordChangeMock({ isMfaActive: true })] },
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)

    await fillPasswords(canvas)
    const code = await canvas.findByLabelText(CODE_LABEL)
    await save(canvas)
    expect(await canvas.findByText('This field is required.')).toBeInTheDocument()

    await userEvent.type(code, '000000')
    await save(canvas)
    expect(await canvas.findByText(INCORRECT_CODE_MESSAGE)).toBeInTheDocument()

    await userEvent.clear(code)
    await userEvent.type(code, VALID_CODE)
    await save(canvas)
    await waitFor(() => expect(args.onSuccess).toHaveBeenCalled())
    // Cleared for the next change
    expect(code).toHaveValue('')
  },
}

/** No 2FA status to go by, so the field shows up once the backend asks for the code */
export const CodeAskedByBackend: Story = {
  parameters: { msw: { handlers: [mePasswordChangeMock({ isMfaActive: true })] } },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)

    await fillPasswords(canvas)
    expect(canvas.queryByLabelText(CODE_LABEL)).not.toBeInTheDocument()
    await save(canvas)

    const code = await canvas.findByLabelText(CODE_LABEL)
    expect(canvas.getByText('This field is required.')).toBeInTheDocument()
    await userEvent.type(code, VALID_CODE)
    await save(canvas)
    await waitFor(() => expect(args.onSuccess).toHaveBeenCalled())
  },
}
