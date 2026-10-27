import type { Meta, StoryObj } from '@storybook/react-webpack5'
import type { HttpHandler } from 'msw'
import { toast } from 'react-hot-toast'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import type { EmailAddress } from '#/api/models/emailAddress'
import type { Canvas } from '#/auth/authStoryHelpers'
import organizationMock from '#/endpoints/organization.mocks'
import {
  PENDING_EMAIL,
  VERIFIED_EMAIL,
  userEmailChangedMock,
  userEmailInvalidMock,
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
