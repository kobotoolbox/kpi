import type { Meta, StoryObj } from '@storybook/react-webpack5'
import type { HttpHandler } from 'msw'
import { toast } from 'react-hot-toast'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import type { EmailAddress } from '#/api/models/emailAddress'
import organizationMock from '#/endpoints/organization.mocks'
import {
  PENDING_EMAIL,
  VERIFIED_EMAIL,
  userEmailChangedMock,
  userEmailInvalidMock,
  userEmailReauthRequiredMock,
  userEmailsListMock,
  userEmailsRemovedMock,
} from '#/endpoints/userEmails.mocks'
import { queryClientDecorator } from '#/query/queryClient.mocks'
import { RequireOrg } from '#/router/RequireOrg'
import { hydrateProfileStoreForStories } from '#/stores/profile.mocks'
import ToasterConfig from '#/toasterConfig'
import EmailSection from './emailSection.component'

const REAUTH_MESSAGE = /log out and log back in/i

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

/** The backend's `detail` would otherwise end up in a toast, which tells the user nothing they can act on. */
async function expectNoReauthToast() {
  await expect(within(document.body).queryByText(/Re-authentication is required/)).not.toBeInTheDocument()
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
        {/* The real app mounts this in `BasicLayout`; without it `notify()` output has nowhere to render */}
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
  },
}

export const RejectedAddress: Story = {
  ...withEmails([VERIFIED_EMAIL], userEmailInvalidMock()),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    const input = await canvas.findByRole('textbox')
    // The field starts out holding the current address, which arrives with the profile.
    await waitFor(() => expect(input).toHaveValue(VERIFIED_EMAIL.email))

    await userEvent.clear(input)
    await userEvent.type(input, 'nope@example.com')
    await userEvent.click(canvas.getByRole('button', { name: 'Change' }))

    await canvas.findByText('Enter a valid email address.')
  },
}

/** Without a recent login, "Change" explains what to do. */
export const ChangeNeedsReauthentication: Story = {
  ...withEmails([VERIFIED_EMAIL], userEmailReauthRequiredMock()),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    const input = await canvas.findByRole('textbox')
    await waitFor(() => expect(input).toHaveValue(VERIFIED_EMAIL.email))

    await userEvent.clear(input)
    await userEvent.type(input, 'other@example.com')
    await userEvent.click(canvas.getByRole('button', { name: 'Change' }))

    await canvas.findByText(REAUTH_MESSAGE)
    await expectNoReauthToast()
  },
}

/** Without a recent login, "Resend" loses the pending email, so it leaves the screen too. */
export const ResendNeedsReauthentication: Story = {
  ...withEmails([VERIFIED_EMAIL, PENDING_EMAIL], userEmailReauthRequiredMock()),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await userEvent.click(await canvas.findByRole('button', { name: 'Resend' }))

    await canvas.findByText(REAUTH_MESSAGE)
    await waitFor(() => expect(canvas.queryByRole('button', { name: 'Resend' })).not.toBeInTheDocument())
    await expectNoReauthToast()
  },
}
