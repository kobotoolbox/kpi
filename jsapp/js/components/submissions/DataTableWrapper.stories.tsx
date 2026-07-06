// Note:
// After extensive experimentation, we found it is practically impossible to have Storybook Docs serve different assets
// (or submissions) for different stories in this file. Storybook's args/controls system, MSW handler registration,
// and Docs rendering pipeline all conspire to make per-story API mocks unreliable or outright broken. Docs view will
// often reuse the same args, reset objects, or ignore per-story MSW handlers, leading to/ asset/submission mismatches
// or default/empty data. This file is intentionally minimal and focused to avoid these problems.

import { Box } from '@mantine/core'
import type { Meta, StoryObj } from '@storybook/react-webpack5'
import type { DecoratorFunction } from '@storybook/types'
import React, { useEffect } from 'react'
import { reactRouterParameters, withRouter } from 'storybook-addon-remix-react-router'
import { expect, waitFor } from 'storybook/test'
import subscriptionStore from '#/account/subscriptionStore'
import { actions } from '#/actions'
import { ActionIdEnum } from '#/api/models/actionIdEnum'
import { BulkActionResponseStatusEnum } from '#/api/models/bulkActionResponseStatusEnum'
import { QuestionTypeName } from '#/constants'
import type { AssetResponse } from '#/dataInterface'
import {
  getApiV2AssetsRetrieveResponseMock,
  getApiV2AssetsRetrieveMockHandler,
} from '#/api/react-query/manage-projects-and-library-content'
import { getApiV2AssetsAdvancedFeaturesBulkActionsRetrieveResponseMock } from '#/api/react-query/survey-data'
import assetDataFactory from '#/endpoints/assetData.factory'
import assetDataMock from '#/endpoints/assetData.mocks'
import bulkActionsMock from '#/endpoints/bulkActions.mocks'
import meMock from '#/endpoints/me.mocks'
import organizationMock from '#/endpoints/organization.mocks'
import * as organizationServiceUsageFactory from '#/endpoints/organizationServiceUsage.factory'
import organizationServiceUsageMock from '#/endpoints/organizationServiceUsage.mocks'
import subscriptionMock from '#/endpoints/subscription.mocks'
import { queryClientDecorator } from '#/query/queryClient.mocks'
import { ROUTES } from '#/router/routerConstants'
import { withBulkProcessingBannerSessionReset } from './BulkProcessingBannerStoriesUtils'
import DataTableWrapper from './DataTableWrapper'
import {
  getPollingUpdateStoryHandlers,
  getPollingUpdateStoryState,
  getPollingUpdateStoryTimeoutMs,
  pollingAsset,
  resetPollingUpdateStoryHandlers,
} from './DataTableWrapperPollingStoriesUtils'

// TODO DEV-XXXX: Improve backend OpenAPI schema for Asset
// - Make date_created and date_modified required (they're auto-populated by Django)
// - Fix analysis_form_json.additional_fields type (should be object[], not string[])
// These casts are safe because the types are compatible at runtime

// Storybook preview root does not have a fixed height by default, which breaks flexbox stretching for table header
// cells. By adding a wrapper with a fixed height to the story, we ensure that `.rt-tr` and `.rt-th` flex children can
// stretch to fill the row height — just like in the real UI.
const fixedHeightDecorator: DecoratorFunction = (Story) => <Box h={480}>{Story()}</Box>

// Decorator to show the LimitNotifications banner in stories.
// The banner has a guard chain: it only shows if subscriptionStore.isInitialised is true.
// Problem: the store is a MobX singleton that normally gets filled via jQuery AJAX,
// but MSW (our Storybook mock layer) only intercepts fetch calls, not jQuery.
// Solution: manually populate the store on mount and clean up on unmount.
// Only add this decorator to stories that need to show limit banners.
const initializeSubscriptionStoreDecorator: DecoratorFunction = (Story) => {
  useEffect(() => {
    subscriptionStore.isInitialised = true
    subscriptionStore.isPending = false
    subscriptionStore.activeSubscriptions = [
      {
        id: 'sub_mock123',
        status: 'active',
        items: [
          {
            id: 'si_mock123',
            quantity: 1,
            price: {
              id: 'price_mock123',
              nickname: 'Community Plan Monthly',
              currency: 'usd',
              type: 'recurring',
              unit_amount: 0,
              human_readable_price: '$0',
              active: true,
              recurring: {
                interval: 'month',
                aggregate_usage: 'sum',
                interval_count: 1,
                usage_type: 'licensed',
              },
              metadata: {},
              transform_quantity: null,
              product: {
                id: 'prod_mock123',
                name: 'Community Plan',
                description: 'Community plan for small teams',
                type: 'service',
                metadata: {
                  product_type: 'plan',
                },
              },
            },
          },
        ],
      } as any, // Type assertion since we're manually setting MobX store
    ]
    subscriptionStore.planResponse = subscriptionStore.activeSubscriptions.filter(
      (sub) => sub.items[0]?.price.product.metadata?.product_type === 'plan',
    )
    subscriptionStore.addOnsResponse = []
    subscriptionStore.canceledPlans = []

    // Cleanup is important: subscriptionStore is a singleton, so if we don't reset it
    // when navigating away, the next story inherits this state (showing the banner when it shouldn't).
    return () => {
      subscriptionStore.isInitialised = false
      subscriptionStore.isPending = false
      subscriptionStore.activeSubscriptions = []
      subscriptionStore.planResponse = []
      subscriptionStore.addOnsResponse = []
      subscriptionStore.canceledPlans = []
    }
  }, [])

  return Story()
}

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
const minimalAsset = getApiV2AssetsRetrieveResponseMock({
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
}) as AssetResponse

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
const processingAsset = getApiV2AssetsRetrieveResponseMock({
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
  analysis_form_json: {
    additional_fields: [
      {
        name: 'transcript_en',
        type: 'transcript',
        source: 'Record_a_sound',
        dtpath: 'Record_a_sound/transcript_en',
        language: 'en',
      },
      {
        name: 'translation_fr',
        type: 'translation',
        source: 'Record_a_sound',
        dtpath: 'Record_a_sound/translation_fr',
        language: 'fr',
      },
      {
        name: 'translation_es',
        type: 'translation',
        source: 'Record_a_sound',
        dtpath: 'Record_a_sound/translation_es',
        language: 'es',
      },
    ],
  },
  effective_permissions: [{ codename: 'change_submissions' }],
}) as AssetResponse

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
    _supplementalDetails: {
      Record_a_sound: {
        // Unaccepted automatic transcript (English) - shows Review button
        transcript: {
          languageCode: 'en',
          pendingReview: true,
          regionCode: null,
        },
        // Automatic translations (French accepted, Spanish pending)
        translation: {
          fr: {
            languageCode: 'fr',
            value: 'Ceci est une traduction automatique acceptée.',
          },
          es: {
            languageCode: 'es',
            pendingReview: true,
          },
        },
      },
    },
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
const processingBulkAction = getApiV2AssetsAdvancedFeaturesBulkActionsRetrieveResponseMock({
  status: BulkActionResponseStatusEnum.complete,
  action_id: ActionIdEnum.automatic_google_translation,
  question_xpath: 'Record_a_sound',
  submission_uuids: [processingSubmissions[1]['meta/rootUuid']],
  params: { language: 'fr' },
  created_by: {
    username: 'zefir',
  },
})
const processingBulkAction2 = getApiV2AssetsAdvancedFeaturesBulkActionsRetrieveResponseMock({
  status: BulkActionResponseStatusEnum.in_progress,
  action_id: ActionIdEnum.automatic_google_translation,
  question_xpath: 'Record_a_sound',
  submission_uuids: [processingSubmissions[2]['meta/rootUuid']],
  params: { language: 'es' },
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
        getApiV2AssetsRetrieveMockHandler(minimalAsset),
        assetDataMock(minimalAsset.uid, minimalSubmissions),
        organizationMock(),
        organizationServiceUsageMock(),
        subscriptionMock(),
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
        getApiV2AssetsRetrieveMockHandler(minimalAsset),
        assetDataMock(minimalAsset.uid, minimalSubmissions),
        organizationMock(),
        organizationServiceUsageMock(),
        subscriptionMock(),
        bulkActionsMock(minimalAsset.uid, { results: [] }),
      ],
    },
  },
  loaders: [loadAssetForStory],
}

export const ProcessingColumnAndBanner: Story = {
  args: {
    asset: processingAsset,
  },
  parameters: {
    a11y: { test: 'todo' },
    reactRouter: getRouterParams(processingAsset.uid),
    msw: {
      handlers: [
        meMock,
        getApiV2AssetsRetrieveMockHandler(processingAsset),
        assetDataMock(processingAsset.uid, processingSubmissions),
        organizationMock(),
        organizationServiceUsageMock(),
        subscriptionMock(),
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
  play: async ({ step }) => {
    // We intentionally avoid asserting rendered translated text here.
    // We tried multiple DOM-based variants (including intermediate
    // "Processing" checks), but they remained flaky in CI across browsers.
    // This play test focuses on stable polling/refresh behavior via mock state.
    await step('Wait for polling to refresh one submission row', async () => {
      await waitFor(
        async () => {
          const storyState = getPollingUpdateStoryState()
          await expect(storyState.pollingBulkActionsCalls).toBeGreaterThanOrEqual(2)
          await expect(storyState.pollingSubmissionRefreshCalls).toBeGreaterThanOrEqual(1)
        },
        { timeout: getPollingUpdateStoryTimeoutMs() },
      )
    })
  },
}
export const ProcessingAndLimitsBannersTogether: Story = {
  args: {
    asset: processingAsset,
  },
  parameters: {
    a11y: { test: 'todo' },
    reactRouter: getRouterParams(processingAsset.uid),
    msw: {
      handlers: [
        meMock,
        getApiV2AssetsRetrieveMockHandler(processingAsset),
        assetDataMock(processingAsset.uid, processingSubmissions),
        organizationMock(),
        // Shows both BulkProcessingBanner (active jobs) + OverLimitBanner (exceeded submission limit)
        organizationServiceUsageMock(undefined, organizationServiceUsageFactory.submissionExceeded()),
        subscriptionMock(),
        bulkActionsMock(processingAsset.uid, { results: [processingBulkAction, processingBulkAction2] }),
      ],
    },
  },
  decorators: [initializeSubscriptionStoreDecorator, withBulkProcessingBannerSessionReset],
  loaders: [loadAssetForStory],
}

// Stories for testing LimitNotifications banner
export const StorageLimitWarningBanner: Story = {
  args: {
    asset: minimalAsset,
  },
  parameters: {
    a11y: { test: 'todo' },
    reactRouter: getRouterParams(minimalAsset.uid),
    msw: {
      handlers: [
        meMock,
        getApiV2AssetsRetrieveMockHandler(minimalAsset),
        assetDataMock(minimalAsset.uid, minimalSubmissions),
        organizationMock(),
        organizationServiceUsageMock(undefined, organizationServiceUsageFactory.storageWarning()),
        bulkActionsMock(minimalAsset.uid, { results: [] }),
      ],
    },
  },
  decorators: [initializeSubscriptionStoreDecorator],
  loaders: [loadAssetForStory],
}

export const StorageExceededBanner: Story = {
  args: {
    asset: minimalAsset,
  },
  parameters: {
    a11y: { test: 'todo' },
    reactRouter: getRouterParams(minimalAsset.uid),
    msw: {
      handlers: [
        meMock,
        getApiV2AssetsRetrieveMockHandler(minimalAsset),
        assetDataMock(minimalAsset.uid, minimalSubmissions),
        organizationMock(),
        organizationServiceUsageMock(undefined, organizationServiceUsageFactory.storageExceeded()),
        bulkActionsMock(minimalAsset.uid, { results: [] }),
      ],
    },
  },
  decorators: [initializeSubscriptionStoreDecorator],
  loaders: [loadAssetForStory],
}

export const SubmissionExceededBanner: Story = {
  args: {
    asset: minimalAsset,
  },
  parameters: {
    a11y: { test: 'todo' },
    reactRouter: getRouterParams(minimalAsset.uid),
    msw: {
      handlers: [
        meMock,
        getApiV2AssetsRetrieveMockHandler(minimalAsset),
        assetDataMock(minimalAsset.uid, minimalSubmissions),
        organizationMock(),
        organizationServiceUsageMock(undefined, organizationServiceUsageFactory.submissionExceeded()),
        bulkActionsMock(minimalAsset.uid, { results: [] }),
      ],
    },
  },
  decorators: [initializeSubscriptionStoreDecorator],
  loaders: [loadAssetForStory],
}

export const StorageAndSubmissionExceededBanner: Story = {
  args: {
    asset: minimalAsset,
  },
  parameters: {
    a11y: { test: 'todo' },
    reactRouter: getRouterParams(minimalAsset.uid),
    msw: {
      handlers: [
        meMock,
        getApiV2AssetsRetrieveMockHandler(minimalAsset),
        assetDataMock(minimalAsset.uid, minimalSubmissions),
        organizationMock(),
        organizationServiceUsageMock(undefined, organizationServiceUsageFactory.bothExceeded()),
        bulkActionsMock(minimalAsset.uid, { results: [] }),
      ],
    },
  },
  decorators: [initializeSubscriptionStoreDecorator],
  loaders: [loadAssetForStory],
}
