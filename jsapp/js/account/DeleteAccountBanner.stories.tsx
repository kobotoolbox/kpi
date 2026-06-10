import type { Meta, StoryObj } from '@storybook/react-webpack5'
import { withRouter } from 'storybook-addon-remix-react-router'
import { expect, waitFor, within } from 'storybook/test'
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

    // Wait for the delete account button to appear (means auth and data loading complete)
    const deleteButton = await canvas.findByRole('button', { name: /delete account/i }, { timeout: 5000 })

    // Wait for loading state to complete (ellipsis should disappear)
    await waitFor(
      () => {
        const ellipsisText = canvas.queryByText('…')
        expect(ellipsisText).not.toBeInTheDocument()
      },
      { timeout: 5000 },
    )

    // Delete button should be disabled when user has assets
    expect(deleteButton).toBeDisabled()
  },
}

export const UserHasAssets: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // Wait for the delete account button to appear
    const deleteButton = await canvas.findByRole('button', { name: /delete account/i }, { timeout: 5000 })

    // Wait for loading to complete (ellipsis disappears)
    await waitFor(
      () => {
        expect(canvas.queryByText('…')).not.toBeInTheDocument()
      },
      { timeout: 5000 },
    )

    // Should show message about deleting/transferring projects
    expect(canvas.getByText(/need to delete or transfer ownership/i)).toBeInTheDocument()

    // Delete button should be disabled
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

    // Wait for the delete account button to appear
    const deleteButton = await canvas.findByRole('button', { name: /delete account/i }, { timeout: 5000 })

    // Wait for loading to complete (ellipsis disappears)
    await waitFor(
      () => {
        expect(canvas.queryByText('…')).not.toBeInTheDocument()
      },
      { timeout: 5000 },
    )

    // Should show message about deleting account
    expect(canvas.getByText(/delete your account and all your account data/i)).toBeInTheDocument()

    // Delete button should be enabled
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

    // Wait for the delete account button to appear
    const deleteButton = await canvas.findByRole('button', { name: /delete account/i }, { timeout: 5000 })

    // For organization owners, message should appear (checking for asset loading isn't necessary since it's blocked)
    expect(canvas.getByText(/transfer ownership of your organization/i)).toBeInTheDocument()

    // Delete button should be disabled
    expect(deleteButton).toBeDisabled()
  },
}
