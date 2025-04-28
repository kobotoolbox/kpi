import type { Meta, StoryObj } from '@storybook/react'
import { reactRouterParameters, withRouter } from 'storybook-addon-remix-react-router'
import { queryClientDecorator } from '#/query/queryClient.mock'
import { ROUTES } from '#/router/routerConstants'
import FormActivity from './FormActivity'
import assetHistoryMock, { mockAssetUid } from './assetHistory.mock'
import assetHistoryActionsMock from './assetHistoryActions.mock'

const meta: Meta<typeof FormActivity> = {
  title: 'Features/FormActivity',
  component: FormActivity,
  argTypes: {},
  parameters: {
    msw: {
      handlers: [assetHistoryMock, assetHistoryActionsMock],
    },
    reactRouter: reactRouterParameters({
      location: {
        pathParams: { uid: mockAssetUid },
      },
      routing: { path: ROUTES.FORM_ACTIVITY },
    }),
  },
  decorators: [withRouter, queryClientDecorator],
}

export default meta
type Story = StoryObj<typeof FormActivity>

export const Default: Story = {}
