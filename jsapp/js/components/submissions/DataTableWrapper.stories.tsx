// NOTE FOR FUTURE MAINTAINERS:
//
// After extensive experimentation, we found it is practically impossible to have Storybook Docs serve different assets
// (or submissions) for different stories in this file. Storybook's args/controls system, MSW handler registration,
// and Docs rendering pipeline all conspire to make per-story API mocks unreliable or outright broken.
// Docs view will often reuse the same args, reset objects, or ignore per-story MSW handlers, leading to
// asset/submission mismatches or default/empty data.
//
// This file is intentionally minimal and focused on a single scenario to avoid these pitfalls.

import { Box } from '@mantine/core'
import type { Meta, StoryObj } from '@storybook/react-webpack5'
import type { DecoratorFunction } from '@storybook/types'
import React from 'react'
import { reactRouterParameters, withRouter } from 'storybook-addon-remix-react-router'
import { actions } from '#/actions'
import { QuestionTypeName } from '#/constants'
import assetFactory from '#/endpoints/asset.factory'
import assetMock from '#/endpoints/asset.mocks'
import assetDataFactory from '#/endpoints/assetData.factory'
import assetDataMock from '#/endpoints/assetData.mocks'
import bulkActionsMock, {
  completeBulkActionsResponse,
  failedBulkActionsResponse,
  processingBulkActionsResponse,
} from '#/endpoints/bulkActions.mocks'
import meMock from '#/endpoints/me.mocks'
import organizationMock from '#/endpoints/organization.mocks'
import { queryClientDecorator } from '#/query/queryClient.mocks'
import { ROUTES } from '#/router/routerConstants'
import DataTableWrapper from './DataTableWrapper'

// Storybook preview root does not have a fixed height by default, which breaks flexbox stretching for table header
// cells. By adding a wrapper with a fixed height to the story, we ensure that `.rt-tr` and `.rt-th` flex children can
// stretch to fill the row height — just like in the real UI.
const fixedHeightDecorator: DecoratorFunction = (Story) => <Box h={360}>{Story()}</Box>

// Minimal asset and submissions for simple stories
const minimalAsset = assetFactory({
  uid: 'audio-asset-uid',
  name: 'Audio Form',
  content: {
    schema: '1',
    survey: [
      {
        type: QuestionTypeName.audio,
        $kuid: 'snd1',
        label: ['Record a sound'],
        $xpath: 'Record_a_sound',
        required: false,
        $autoname: 'Record_a_sound',
      },
    ],
    settings: {},
    translated: ['label'],
    translations: [null],
  },
  effective_permissions: [{ codename: 'change_submissions' }],
})
const minimalSubmissions = [
  assetDataFactory(1, {
    Record_a_sound: 'test1.mp3',
    _attachments: [
      {
        download_url: './test1.mp3',
        mimetype: 'audio/x-m3a',
        filename: 'uu/attachments/test1.mp3',
        media_file_basename: 'test1.mp3',
        uid: 'tst1',
        is_deleted: false,
        question_xpath: 'Record_a_sound',
      },
    ],
  }),
  assetDataFactory(2, {
    Record_a_sound: 'test2.mp3',
    _attachments: [
      {
        download_url: './test2.mp3',
        mimetype: 'audio/x-m3a',
        filename: 'uu/attachments/test2.mp3',
        media_file_basename: 'test2.mp3',
        uid: 'tst2',
        is_deleted: false,
        question_xpath: 'Record_a_sound',
      },
    ],
  }),
]

const meta: Meta<typeof DataTableWrapper> = {
  title: 'Components/DataTableWrapper',
  component: DataTableWrapper,
  args: {
    asset: minimalAsset,
  },
  parameters: {
    a11y: { test: 'todo' },
    reactRouter: reactRouterParameters({
      location: {
        // We need route with uid, because `tableStore` uses `getRouteAssetUid`
        pathParams: { uid: minimalAsset.uid },
      },
      routing: { path: ROUTES.FORM_TABLE },
    }),
    msw: {
      handlers: [
        meMock,
        assetMock(minimalAsset.uid, minimalAsset),
        assetDataMock(minimalAsset.uid, minimalSubmissions),
        organizationMock(),
      ],
    },
  },
  decorators: [withRouter, queryClientDecorator, fixedHeightDecorator],
  loaders: [
    async () => {
      // Set the hash to mimic the real app route for this asset, so that (deprecated) `getCurrentPath` works.
      // The proper `reactRouter` way doesn't work here entirely, because `getCurrentPath` uses `location.hash`.
      window.location.hash = ROUTES.FORM_TABLE.replace(':uid', minimalAsset.uid)
      // We need to load asset in `assetStore`, because `tableStore` needs it. Normally `FormSubScreens` is initiating
      // the load asset API call, but since we use DataTableWrapper directly, we have to make the call manually.
      actions.resources.loadAsset({ id: minimalAsset.uid })
      return {}
    },
  ],
}

export default meta
type Story = StoryObj<typeof DataTableWrapper>

export const Default: Story = {}

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
