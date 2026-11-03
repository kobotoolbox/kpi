import type { Meta, StoryObj } from '@storybook/react-webpack5'
import type { HttpHandler } from 'msw'
import { toast } from 'react-hot-toast'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import type { CredentialField } from '#/account/security/reauthentication/reauthentication.api'
import type { EmailAddress } from '#/api/models/emailAddress'
import type { Flow } from '#/api/models/flow'
import { type Canvas, findField } from '#/auth/authStoryHelpers'
import { INCORRECT_CODE_MESSAGE, VALID_CODE, VALID_PASSWORD, reauthenticateMocks } from '#/endpoints/mfa.mocks'
import organizationMock from '#/endpoints/organization.mocks'
import {
  PENDING_EMAIL,
  VERIFIED_EMAIL,
  userEmailChangedMock,
  userEmailInvalidMock,
  userEmailReauthenticationRequiredMock,
  userEmailsListMock,
  userEmailsRemovedMock,
} from '#/endpoints/userEmails.mocks'
import { queryClientDecorator } from '#/query/queryClient.mocks'
import { RequireOrg } from '#/router/RequireOrg'
import { hydrateProfileStoreForStories } from '#/stores/profile.mocks'
import ToasterConfig from '#/toasterConfig'
import EmailSection from './emailSection.component'

/**
 * Everything one story needs: its own copy of the rows, the organization the section is gated on, and any `refusals`
 * the `POST` should hit first. Spelled out per story, because Storybook replaces the handler array instead of merging.
 */
function withEmails(initial: EmailAddress[], ...refusals: HttpHandler[]) {
  const emails = [...initial]

  return {
    parameters: {
      msw: {
        handlers: [
          ...refusals,
          userEmailsListMock(emails),
          userEmailChangedMock(emails),
          userEmailsRemovedMock(emails),
          organizationMock(),
        ],
      },
    },
    beforeEach: () => {
      emails.splice(0, emails.length, ...initial)
    },
  }
}

const PASSWORD_FLOW: Flow = { id: 'reauthenticate' }
const CODE_FLOW: Flow = { id: 'mfa_reauthenticate', types: ['recovery_codes', 'totp'] }
const SECURITY_KEY_FLOW: Flow = { id: 'mfa_reauthenticate', types: ['webauthn'] }

/** Like {@link withEmails}, but the `POST` is refused until every one of `flows` is done */
function withStaleSession(flows: Flow[]) {
  const accepted = new Set<CredentialField>()
  const needed = flows.map((flow): CredentialField => (flow === PASSWORD_FLOW ? 'password' : 'code'))
  const story = withEmails(
    [VERIFIED_EMAIL],
    userEmailReauthenticationRequiredMock(flows, () => needed.every((field) => accepted.has(field))),
    ...reauthenticateMocks((field) => accepted.add(field)),
  )

  return {
    ...story,
    beforeEach: () => {
      accepted.clear()
      story.beforeEach()
    },
  }
}

/** Submits the typed address and returns the modal it gets refused with */
async function submitUntilAsked(canvas: Canvas) {
  await userEvent.click(canvas.getByRole('button', { name: 'Change' }))

  // Mantine renders the modal into a portal, outside the canvas
  const dialog = await within(document.body).findByRole('dialog', { name: "Confirm it's you" })
  // The refusal is handled, so the vague toast it used to raise stays away
  expect(canvas.queryByText('Re-authentication is required for this action.')).not.toBeInTheDocument()
  return within(dialog)
}

/** Swaps the current address in the field for `address` */
async function typeNewEmail(canvas: Canvas, address: string) {
  const input = await canvas.findByRole('textbox')
  // The field starts out holding the current address, which arrives with the profile.
  await waitFor(() => expect(input).toHaveValue(VERIFIED_EMAIL.email))

  await userEvent.clear(input)
  await userEvent.type(input, address)
}

const meta: Meta<typeof EmailSection> = {
  title: 'Features/EmailSection',
  component: EmailSection,
  tags: ['!autodocs'],
  parameters: {
    msw: { handlers: [organizationMock()] },
    a11y: { disable: true },
  },
  beforeEach: () => {
    // Ensure other toasts are not displayed here
    toast.remove()
    hydrateProfileStoreForStories({ email: VERIFIED_EMAIL.email })
    return () => hydrateProfileStoreForStories()
  },
  decorators: [
    (Story) => (
      <RequireOrg>
        {/* The real app mounts this in `App`; without it `notify()` output has nowhere to render */}
        <ToasterConfig />
        <Story />
      </RequireOrg>
    ),
    queryClientDecorator,
  ],
}

export default meta
type Story = StoryObj<typeof EmailSection>

export const PendingConfirmation: Story = {
  ...withEmails([VERIFIED_EMAIL, PENDING_EMAIL]),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await canvas.findByText(new RegExp(`Check your email ${PENDING_EMAIL.email}`))
    expect(canvas.getByText(new RegExp(`will replace ${VERIFIED_EMAIL.email}`))).toBeInTheDocument()
    expect(canvas.getByRole('button', { name: 'Resend' })).toBeEnabled()
    // No editing while an address waits for confirmation.
    expect(canvas.queryByRole('textbox')).not.toBeInTheDocument()
    expect(canvas.queryByRole('button', { name: 'Change' })).not.toBeInTheDocument()
  },
}

export const ChangeAndRemove: Story = {
  ...withEmails([VERIFIED_EMAIL]),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await canvas.findByRole('textbox')
    expect(canvas.getByRole('button', { name: 'Change' })).toBeDisabled()

    await typeNewEmail(canvas, PENDING_EMAIL.email)
    await userEvent.click(canvas.getByRole('button', { name: 'Change' }))

    await canvas.findByText(new RegExp(`Check your email ${PENDING_EMAIL.email}`))
    expect(canvas.queryByRole('textbox')).not.toBeInTheDocument()

    await userEvent.click(canvas.getByRole('button', { name: 'Remove' }))

    // Back to the current address, so there is nothing to change yet.
    expect(await canvas.findByRole('textbox')).toHaveValue(VERIFIED_EMAIL.email)
    expect(canvas.getByRole('button', { name: 'Change' })).toBeDisabled()
  },
}

export const InvalidAddress: Story = {
  ...withEmails([VERIFIED_EMAIL]),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await typeNewEmail(canvas, 'nope')
    await userEvent.click(canvas.getByRole('button', { name: 'Change' }))

    await canvas.findByText('Invalid email address')
    expect(canvas.getByRole('textbox')).toBeInvalid()
  },
}

export const RejectedAddress: Story = {
  ...withEmails([VERIFIED_EMAIL], userEmailInvalidMock()),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await typeNewEmail(canvas, 'nope@example.com')
    await userEvent.click(canvas.getByRole('button', { name: 'Change' }))

    await canvas.findByText('Enter a valid email address.')
  },
}

/** With 2FA on, KPI wants the password and a code. The same code field serves SSO-only accounts alone. */
export const Reauthenticate: Story = {
  ...withStaleSession([PASSWORD_FLOW, CODE_FLOW]),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const confirm = (modal: Canvas) => userEvent.click(modal.getByRole('button', { name: 'Confirm' }))

    // Cancelling changes nothing, and the typed address is still there to try again
    await typeNewEmail(canvas, PENDING_EMAIL.email)
    let modal = await submitUntilAsked(canvas)
    await userEvent.click(modal.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(within(document.body).queryByRole('dialog')).not.toBeInTheDocument())
    expect(canvas.getByRole('textbox')).toHaveValue(PENDING_EMAIL.email)
    expect(canvas.queryByText(/Check your email/)).not.toBeInTheDocument()

    modal = await submitUntilAsked(canvas)
    const password = await findField(modal, 'Password')
    const code = await findField(modal, 'Code')

    await userEvent.type(password, 'wrong')
    await userEvent.type(code, '000000')
    await confirm(modal)
    await modal.findByText('Incorrect password.')

    await userEvent.clear(password)
    await userEvent.type(password, VALID_PASSWORD)
    await confirm(modal)
    await modal.findByText(INCORRECT_CODE_MESSAGE)

    await userEvent.clear(code)
    await userEvent.type(code, VALID_CODE)
    await confirm(modal)

    // The address typed before the interruption goes through
    await canvas.findByText(new RegExp(`Check your email ${PENDING_EMAIL.email}`))
    await waitFor(() => expect(within(document.body).queryByRole('dialog')).not.toBeInTheDocument())
  },
}

export const ReauthenticationNeedsNewLogin: Story = {
  ...withStaleSession([PASSWORD_FLOW, SECURITY_KEY_FLOW]),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await typeNewEmail(canvas, PENDING_EMAIL.email)
    const modal = await submitUntilAsked(canvas)

    await modal.findByText('To continue, please log out and log back in, then try again.')
    expect(modal.getByRole('button', { name: 'Log out' })).toBeEnabled()
    expect(modal.queryByRole('button', { name: 'Confirm' })).not.toBeInTheDocument()
  },
}
