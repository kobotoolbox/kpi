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
