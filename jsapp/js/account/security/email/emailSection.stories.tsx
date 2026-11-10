import type { Meta, StoryObj } from '@storybook/react-webpack5'
import { http, HttpResponse } from 'msw'
import { toast } from 'react-hot-toast'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { getMeEmailsListMockHandler } from '#/api/react-query/user-team-organization-usage/msw'
import organizationMock from '#/endpoints/organization.mocks'
import { queryClientDecorator } from '#/query/queryClient.mocks'
import { RequireOrg } from '#/router/RequireOrg'
import ToasterConfig from '#/toasterConfig'
import EmailSection from './emailSection.component'

const PRIMARY = { email: 'me@example.com', primary: true, verified: true }
const PENDING = { email: 'new@example.com', primary: false, verified: false }
const REAUTH_MESSAGE = /log out and log back in/i

/** What `/me/emails/` sends without a recent login. */
const reauthRequiredMock = http.post('*/me/emails{/}?', () =>
  HttpResponse.json(
    {
      detail: 'Re-authentication is required for this action.',
      code: 'reauthentication_required',
      flows: [{ id: 'reauthenticate' }],
    },
    { status: 403 },
  ),
)

// Resend deletes the pending email first, so the list must drop it after a DELETE.
let hasPending = true
const pendingEmailMocks = [
  getMeEmailsListMockHandler(() => {
    const results = hasPending ? [PRIMARY, PENDING] : [PRIMARY]
    return { count: results.length, next: null, previous: null, results }
  }),
  http.delete('*/me/emails{/}?', () => {
    hasPending = false
    return new HttpResponse(null, { status: 204 })
  }),
]

/** The raw 403 body used to show up as a toast. */
async function expectNoRawErrorToast() {
  await expect(within(document.body).queryByText(/reauthentication_required/)).not.toBeInTheDocument()
}

const meta: Meta<typeof EmailSection> = {
  title: 'Features/Account/EmailSection',
  component: EmailSection,
  tags: ['!autodocs'],
  parameters: {
    msw: { handlers: [organizationMock(), reauthRequiredMock, ...pendingEmailMocks] },
    a11y: { disable: true },
  },
  beforeEach: () => {
    toast.remove()
    hasPending = true
  },
  decorators: [
    (Story) => (
      <RequireOrg>
        <ToasterConfig />
        <Story />
      </RequireOrg>
    ),
    queryClientDecorator,
  ],
}

export default meta
type Story = StoryObj<typeof EmailSection>

/** Without a recent login, "Change" explains what to do. */
export const ChangeNeedsReauthentication: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const input = await canvas.findByPlaceholderText('Type new email address')
    await userEvent.clear(input)
    await userEvent.type(input, 'other@example.com')
    await userEvent.click(canvas.getByRole('button', { name: 'Change' }))

    await expect(await canvas.findByText(REAUTH_MESSAGE)).toBeInTheDocument()
    await expectNoRawErrorToast()
  },
}

/** Without a recent login, "Resend" loses the pending email, so it leaves the screen too. */
export const ResendNeedsReauthentication: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByRole('button', { name: 'Resend' }))

    await expect(await canvas.findByText(REAUTH_MESSAGE)).toBeInTheDocument()
    await waitFor(() => expect(canvas.queryByRole('button', { name: 'Resend' })).not.toBeInTheDocument())
    await expectNoRawErrorToast()
  },
}
