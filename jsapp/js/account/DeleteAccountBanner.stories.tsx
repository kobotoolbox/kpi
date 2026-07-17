import type { Meta, StoryObj } from '@storybook/react-webpack5'
import { http, HttpResponse } from 'msw'
import { withRouter } from 'storybook-addon-remix-react-router'
import { expect, waitFor, within } from 'storybook/test'
import { endpoints } from '#/api.endpoints'
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
      handlers: [organizationMock(), assetsMock()],
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

    await canvas.findByRole('button', { name: /delete account/i })
    await waitFor(() => expect(canvas.queryByText('…')).not.toBeInTheDocument())

    const deleteButton = canvas.getByRole('button', { name: /delete account/i })
    expect(deleteButton).toBeDisabled()
  },
}

export const UserHasAssets: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await canvas.findByRole('button', { name: /delete account/i })
    await waitFor(() => expect(canvas.queryByText('…')).not.toBeInTheDocument())

    expect(canvas.getByText(/need to delete or transfer ownership/i)).toBeInTheDocument()
    expect(canvas.getByRole('button', { name: /delete account/i })).toBeDisabled()
  },
}

export const UserHasNoAssets: Story = {
  parameters: {
    msw: {
      handlers: [organizationMock(), assetsMock({ count: 0 })],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await canvas.findByRole('button', { name: /delete account/i })
    await waitFor(() => expect(canvas.queryByText('…')).not.toBeInTheDocument())

    expect(canvas.getByText(/delete your account and all your account data/i)).toBeInTheDocument()
    expect(canvas.getByRole('button', { name: /delete account/i })).toBeEnabled()
  },
}

export const UserOwnsMMO: Story = {
  parameters: {
    msw: {
      handlers: [organizationMock({ is_mmo: true }), assetsMock()],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    const deleteButton = await canvas.findByRole('button', { name: /delete account/i })
    expect(canvas.getByText(/transfer ownership of your organization/i)).toBeInTheDocument()
    expect(deleteButton).toBeDisabled()
  },
}

export const UserHasOnlyNonProjectAssets: Story = {
  parameters: {
    msw: {
      handlers: [
        organizationMock(),
        http.get(endpoints.ASSETS_URL, (info) => {
          const query = new URL(info.request.url).searchParams.get('q')

          if (query?.includes('asset_type:survey')) {
            return HttpResponse.json({
              count: 0,
              next: null,
              previous: null,
              results: [],
            })
          }

          return HttpResponse.json({
            count: 2,
            next: null,
            previous: null,
            results: [],
          })
        }),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await canvas.findByRole('button', { name: /delete account/i })
    await waitFor(() => expect(canvas.queryByText('…')).not.toBeInTheDocument())

    expect(canvas.getByText(/delete your account and all your account data/i)).toBeInTheDocument()
    expect(canvas.getByRole('button', { name: /delete account/i })).toBeEnabled()
  },
}
