import { Box } from '@mantine/core'
import type { Meta, StoryObj } from '@storybook/react-webpack5'
import type { DecoratorFunction } from '@storybook/types'
import React from 'react'
import { reactRouterParameters, withRouter } from 'storybook-addon-remix-react-router'
import { actions } from '#/actions'
import assetMock from '#/endpoints/asset.mocks'
import assetDataMock from '#/endpoints/assetData.mocks'
import bulkActionsMock, {
  processingBulkActionsResponse,
  completeBulkActionsResponse,
  failedBulkActionsResponse,
} from '#/endpoints/bulkActions.mocks'
import { queryClientDecorator } from '#/query/queryClient.mocks'
import { ROUTES } from '#/router/routerConstants'
import DataTableWrapper from './DataTableWrapper'
import { assetWithNestedSupplementalDetails } from './submissionUtils.mocks'

// Storybook preview root does not have a fixed height by default, which breaks flexbox stretching for table header
// cells. By adding a wrapper with a fixed height to the story, we ensure that `.rt-tr` and `.rt-th` flex children can
// stretch to fill the row height — just like in the real UI.
const fixedHeightDecorator: DecoratorFunction = (Story) => <Box h={360}>{Story()}</Box>

const meta: Meta<typeof DataTableWrapper> = {
  title: 'Components/DataTableWrapper',
  component: DataTableWrapper,
  args: {
    asset: assetWithNestedSupplementalDetails,
  },
  parameters: {
    a11y: { test: 'todo' },
    reactRouter: reactRouterParameters({
      location: {
        // We need route with uid, because `tableStore` uses `getRouteAssetUid`
        pathParams: { uid: assetWithNestedSupplementalDetails.uid },
      },
      routing: { path: ROUTES.FORM_TABLE },
    }),
    msw: {
      handlers: [
        assetMock(assetWithNestedSupplementalDetails.uid, assetWithNestedSupplementalDetails),
        assetDataMock(assetWithNestedSupplementalDetails.uid),
      ],
    },
  },
  decorators: [withRouter, queryClientDecorator, fixedHeightDecorator],
  loaders: [
    async () => {
      // Set the hash to mimic the real app route for this asset, so that (deprecated) `getCurrentPath` works.
      // The proper `reactRouter` way doesn't work here entirely, because `getCurrentPath` uses `location.hash`.
      window.location.hash = ROUTES.FORM_TABLE.replace(':uid', assetWithNestedSupplementalDetails.uid)
      // We need to load asset in `assetStore`, because `tableStore` needs it. Normally `FormSubScreens` is initiating
      // the load asset API call, but since we use DataTableWrapper directly, we have to make the call manually.
      actions.resources.loadAsset({ id: assetWithNestedSupplementalDetails.uid })
      return {}
    },
  ],
}

export default meta
type Story = StoryObj<typeof DataTableWrapper>

export const Default: Story = {}

export const WithNestedSupplementalDetails: Story = {
  args: {
    asset: assetWithNestedSupplementalDetails,
  },
}

export const ProcessingColumn: Story = {
  parameters: {
    msw: {
      handlers: [...meta.parameters?.msw.handlers, bulkActionsMock(processingBulkActionsResponse)],
    },
  },
}

export const CompleteColumn: Story = {
  parameters: {
    msw: {
      handlers: [...meta.parameters?.msw.handlers, bulkActionsMock(completeBulkActionsResponse)],
    },
  },
}

export const FailedColumn: Story = {
  parameters: {
    msw: {
      handlers: [...meta.parameters?.msw.handlers, bulkActionsMock(failedBulkActionsResponse)],
    },
  },
}
