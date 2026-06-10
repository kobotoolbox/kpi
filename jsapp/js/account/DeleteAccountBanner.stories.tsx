import type { Meta, StoryObj } from '@storybook/react-webpack5'
import { withRouter } from 'storybook-addon-remix-react-router'
import { expect, within } from 'storybook/test'
import assetsMock from '#/endpoints/assets.mocks'
import organizationMock from '#/endpoints/organization.mocks'
import { queryClientDecorator } from '#/query/queryClient.mocks'
import { RequireOrg } from '#/router/RequireOrg'
import DeleteAccountBanner from './DeleteAccountBanner'

const meta: Meta<typeof DeleteAccountBanner> = {
  title: 'Components/DeleteAccountBanner',
  component: DeleteAccountBanner,
  argTypes: {},
  parameters: {
    msw: {
      handlers: {
        organization: organizationMock(),
        assets: assetsMock(),
      },
    },
    a11y: { test: 'todo' },
  },
  decorators: [
    (Story) => (
      <RequireOrg>
        <Story />
      </RequireOrg>
    ),
    withRouter,
    queryClientDecorator,
  ],
}

export default meta
type Story = StoryObj<typeof DeleteAccountBanner>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // MSW mocks respond instantly, just wait for React Query to update
    const deleteButton = await canvas.findByRole('button', { name: /delete account/i })
    expect(canvas.queryByText('…')).not.toBeInTheDocument()
    expect(deleteButton).toBeDisabled()
  },
}

export const UserHasAssets: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    const deleteButton = await canvas.findByRole('button', { name: /delete account/i })
    expect(canvas.queryByText('…')).not.toBeInTheDocument()
    expect(canvas.getByText(/need to delete or transfer ownership/i)).toBeInTheDocument()
    expect(deleteButton).toBeDisabled()
  },
}

export const UserHasNoAssets: Story = {
  parameters: {
    msw: {
      handlers: {
        assets: assetsMock({ count: 0 }),
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    const deleteButton = await canvas.findByRole('button', { name: /delete account/i })
    expect(canvas.queryByText('…')).not.toBeInTheDocument()
    expect(canvas.getByText(/delete your account and all your account data/i)).toBeInTheDocument()
    expect(deleteButton).toBeEnabled()
  },
}

export const UserOwnsMMO: Story = {
  parameters: {
    msw: {
      handlers: {
        organization: organizationMock({ is_mmo: true }),
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    const deleteButton = await canvas.findByRole('button', { name: /delete account/i })
    expect(canvas.getByText(/transfer ownership of your organization/i)).toBeInTheDocument()
    expect(deleteButton).toBeDisabled()
  },
}
