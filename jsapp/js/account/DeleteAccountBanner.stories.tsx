import type { Meta, StoryObj } from '@storybook/react-webpack5'
import { withRouter } from 'storybook-addon-remix-react-router'
import assetsMock from '#/endpoints/assets.mocks'
import DeleteAccountBanner from './DeleteAccountBanner'

const meta: Meta<typeof DeleteAccountBanner> = {
  title: 'Components/DeleteAccountBanner',
  component: DeleteAccountBanner,
  argTypes: {},
  parameters: {
    msw: {
      handlers: [assetsMock],
    },
    a11y: { test: 'todo' },
  },
  decorators: [withRouter],
}

export default meta
type Story = StoryObj<typeof DeleteAccountBanner>

export const Default: Story = {}

export const UserHasNoAssets: Story = {
  args: {
    storybookTestId: 'UserHasNoAssets',
  },
}
