// Note:
// After extensive experimentation, we found it is practically impossible to have Storybook Docs serve different assets
// (or submissions) for different stories in this file. Storybook's args/controls system, MSW handler registration,
// and Docs rendering pipeline all conspire to make per-story API mocks unreliable or outright broken. Docs view will
// often reuse the same args, reset objects, or ignore per-story MSW handlers, leading to/ asset/submission mismatches
// or default/empty data. This file is intentionally minimal and focused to avoid these problems.

import { Box } from '@mantine/core'
import type { Meta, StoryObj } from '@storybook/react-webpack5'
import type { DecoratorFunction } from '@storybook/types'
import React from 'react'
import { reactRouterParameters, withRouter } from 'storybook-addon-remix-react-router'
import { expect, waitFor, within } from 'storybook/test'
import { actions } from '#/actions'
import { BulkActionResponseStatusEnum } from '#/api/models/bulkActionResponseStatusEnum'
import { QuestionTypeName } from '#/constants'
import assetFactory from '#/endpoints/asset.factory'
import assetMock from '#/endpoints/asset.mocks'
import assetDataFactory from '#/endpoints/assetData.factory'
import assetDataMock from '#/endpoints/assetData.mocks'
import bulkActionFactory from '#/endpoints/bulkAction.factory'
import bulkActionsMock from '#/endpoints/bulkActions.mocks'
import meMock from '#/endpoints/me.mocks'
import organizationMock from '#/endpoints/organization.mocks'
import organizationServiceUsageMock from '#/endpoints/organizationServiceUsage.mocks'
import { queryClientDecorator } from '#/query/queryClient.mocks'
import { ROUTES } from '#/router/routerConstants'
import { withBulkProcessingBannerSessionReset } from './BulkProcessingBannerStoriesUtils'
import DataTableWrapper from './DataTableWrapper'
import {
  getPollingUpdateStoryHandlers,
  getPollingUpdateStoryTimeoutMs,
  pollingAsset,
  resetPollingUpdateStoryHandlers,
} from './DataTableWrapperPollingStoriesUtils'

// Storybook preview root does not have a fixed height by default, which breaks flexbox stretching for table header
// cells. By adding a wrapper with a fixed height to the story, we ensure that `.rt-tr` and `.rt-th` flex children can
// stretch to fill the row height — just like in the real UI.
const fixedHeightDecorator: DecoratorFunction = (Story) => <Box h={360}>{Story()}</Box>

// Decorator to set the hash for the current asset UID, so that (deprecated) `getCurrentPath` works.
// This replaces the previous loader. It reads the UID from the story's args.asset.uid (if present).
// This ensures each story sets the correct hash for its asset, regardless of which asset is used.
const setAssetHashDecorator: DecoratorFunction = (Story, context) => {
  const assetUid = context.args?.asset?.uid
  if (assetUid) {
    window.location.hash = ROUTES.FORM_TABLE.replace(':uid', assetUid)
  }
  return Story()
}

// DRY loader to load the asset for the current story
const loadAssetForStory = async ({ args }: { args: any }) => {
  const assetUid = args?.asset?.uid
  if (assetUid) {
    actions.resources.loadAsset({ id: assetUid })
  }
  return {}
}

const getRouterParams = (assetUid: string) =>
  reactRouterParameters({
    location: {
      // We need route with uid, because `tableStore` uses `getRouteAssetUid`
      pathParams: { uid: assetUid },
    },
    routing: { path: ROUTES.FORM_TABLE },
  })

// Minimal asset and submissions for simple stories

// Default story asset and submissions
const minimalAsset = assetFactory({
  uid: 'audio-asset-uid',
  name: 'Audio form',
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

// ProcessingColumn story asset and submissions (unique UID)
const processingAsset = assetFactory({
  uid: 'audio-asset-uid-processing',
  name: 'Audio form with processing',
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
const processingSubmissions = [
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
  assetDataFactory(3, {
    Record_a_sound: 'test3.mp3',
    _attachments: [
      {
        download_url: './test3.mp3',
        mimetype: 'audio/x-m3a',
        filename: 'uu/attachments/test3.mp3',
        media_file_basename: 'test3.mp3',
        uid: 'tst3',
        is_deleted: false,
        question_xpath: 'Record_a_sound',
      },
    ],
  }),
]
const processingBulkAction = bulkActionFactory(processingSubmissions[1]['meta/rootUuid'], 'fr', {
  status: BulkActionResponseStatusEnum.in_progress,
  question_xpath: 'Record_a_sound',
  created_by: {
    username: 'zefir',
  },
})
const processingBulkAction2 = bulkActionFactory(processingSubmissions[2]['meta/rootUuid'], 'es', {
  status: BulkActionResponseStatusEnum.pending,
  question_xpath: 'Record_a_sound',
  created_by: {
    username: 'other-user',
  },
})

const meta: Meta<typeof DataTableWrapper> = {
  title: 'Components/DataTableWrapper',
  component: DataTableWrapper,
  async beforeEach() {
    resetPollingUpdateStoryHandlers()
  },
  args: {
    asset: minimalAsset,
  },
  parameters: {
    docs: {
      description: {
        component:
          '⚠️ **Docs view does NOT work reliably for these stories due to per-story MSW handler and asset/submission isolation issues. Use single stories (Default, and Processing Column) please.** Also note that many interactive elements of the table are not mocked and will not work.',
      },
    },
    a11y: { test: 'todo' },
    reactRouter: getRouterParams(minimalAsset.uid),
    msw: {
      handlers: [
        meMock,
        assetMock(minimalAsset.uid, minimalAsset),
        assetDataMock(minimalAsset.uid, minimalSubmissions),
        organizationMock(),
        organizationServiceUsageMock(),
        bulkActionsMock(minimalAsset.uid, { results: [] }),
      ],
    },
  },
  decorators: [withRouter, queryClientDecorator, fixedHeightDecorator, setAssetHashDecorator],
  // No global loaders - use per-story loader for asset isolation. With global loader stories stop working and I already
  // spent too much time debugging this.
}

export default meta
type Story = StoryObj<typeof DataTableWrapper>

export const Default: Story = {
  args: {
    asset: minimalAsset,
  },
  parameters: {
    a11y: { test: 'todo' },
    reactRouter: getRouterParams(minimalAsset.uid),
    msw: {
      handlers: [
        meMock,
        assetMock(minimalAsset.uid, minimalAsset),
        assetDataMock(minimalAsset.uid, minimalSubmissions),
        organizationMock(),
        organizationServiceUsageMock(),
        bulkActionsMock(minimalAsset.uid, { results: [] }),
      ],
    },
  },
  loaders: [loadAssetForStory],
}

export const ProcessingColumn: Story = {
  args: {
    asset: processingAsset,
  },
  parameters: {
    a11y: { test: 'todo' },
    reactRouter: getRouterParams(processingAsset.uid),
    msw: {
      handlers: [
        meMock,
        assetMock(processingAsset.uid, processingAsset),
        assetDataMock(processingAsset.uid, processingSubmissions),
        organizationMock(),
        organizationServiceUsageMock(),
        bulkActionsMock(processingAsset.uid, { results: [processingBulkAction] }),
      ],
    },
  },
  loaders: [loadAssetForStory],
}

export const ProcessingBannerOtherUser: Story = {
  args: {
    asset: processingAsset,
  },
  parameters: {
    a11y: { test: 'todo' },
    reactRouter: getRouterParams(processingAsset.uid),
    msw: {
      handlers: [
        meMock,
        assetMock(processingAsset.uid, processingAsset),
        assetDataMock(processingAsset.uid, processingSubmissions),
        organizationMock(),
        organizationServiceUsageMock(),
        bulkActionsMock(processingAsset.uid, { results: [processingBulkAction, processingBulkAction2] }),
      ],
    },
  },
  decorators: [withBulkProcessingBannerSessionReset],
  loaders: [loadAssetForStory],
}

export const ProcessingPollingRefreshesTranslatedCell: Story = {
  args: {
    asset: pollingAsset,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Starts with a Processing placeholder and updates that row after polling (about 8 seconds) when the mocked bulk action item transitions to complete.',
      },
    },
    a11y: { test: 'todo' },
    reactRouter: getRouterParams(pollingAsset.uid),
    msw: {
      handlers: getPollingUpdateStoryHandlers(),
    },
  },
  loaders: [loadAssetForStory],
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement)

    await step('Verify the row starts in the Processing state', async () => {
      await expect(await canvas.findByText('Processing')).toBeInTheDocument()
    })

    await step('Wait for polling to replace the placeholder with the translated value', async () => {
      await waitFor(
        async () => {
          await expect(
            canvas.getByText('Hola, el procesamiento masivo ha finalizado correctamente.'),
          ).toBeInTheDocument()
        },
        { timeout: getPollingUpdateStoryTimeoutMs() },
      )

      await expect(canvas.queryByText('Processing')).not.toBeInTheDocument()
    })
  },
}
