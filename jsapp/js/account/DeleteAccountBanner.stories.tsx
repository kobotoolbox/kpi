import type { Meta, StoryObj } from '@storybook/react-webpack5'
import type { DecoratorFunction } from '@storybook/types'
import { withRouter } from 'storybook-addon-remix-react-router'
import assetsMock from '#/endpoints/assets.mocks'
import { meMockResponse } from '#/endpoints/me.mocks'
import organizationMock from '#/endpoints/organization.mocks'
import { queryClientDecorator } from '#/query/queryClient.mocks'
import RequireAuth from '#/router/requireAuth'
import DeleteAccountBanner from './DeleteAccountBanner'

const RequireAuthDecorator: DecoratorFunction = (Story) => <RequireAuth>{Story()}</RequireAuth>

const meta: Meta<typeof DeleteAccountBanner> = {
  title: 'Components/DeleteAccountBanner',
  component: DeleteAccountBanner,
  argTypes: {},
  parameters: {
    msw: {
      handlers: [assetsMock, organizationMock(meMockResponse.organization!.uid)],
    },
    a11y: { test: 'todo' },
  },
  decorators: [RequireAuthDecorator, withRouter, queryClientDecorator],
}

export default meta
type Story = StoryObj<typeof DeleteAccountBanner>

export const Default: Story = {}

export const UserHasNoAssets: Story = {
  args: {
    storybookTestId: 'UserHasNoAssets',
  },
}
