import { http, HttpResponse, type PathParams } from 'msw'
import { endpoints } from '#/api.endpoints'
import type { ProjectHistoryLogResponse } from '#/api/models/projectHistoryLogResponse'
import { getApiV2ProjectHistoryLogsListResponseMock } from '#/api/react-query/server-logs-superusers.msw'
import {
  type ActivityLogsItem,
  AuditActions,
  BULK_PROCESSING_ACTION_IDS,
} from '#/components/activity/activity.constants'
import type { PaginatedResponse } from '#/dataInterface'

export const mockAssetUid = 'a1234567890bcdEFGhijkl'

/**
 * Creates a mock history log item using Orval's generated mock.
 *
 * Since the API doesn't have a single-item retrieve endpoint, Orval only generates
 * getApiV2ProjectHistoryLogsListResponseMock (which returns a paginated list).
 * This helper extracts a single item from that list and merges overrides.
 *
 * Note: ActivityLogsItem extends ProjectHistoryLogResponse with typed action/metadata.
 */
type AssetHistoryLogOverrides = Partial<Omit<ActivityLogsItem, 'metadata'>> & {
  metadata?: Partial<ActivityLogsItem['metadata']>
}

const createHistoryLog = (overrides: AssetHistoryLogOverrides = {}): ActivityLogsItem => {
  // Get a sample log from Orval's list mock
  const sampleList = getApiV2ProjectHistoryLogsListResponseMock()
  const baseLog = sampleList.results[0] as ProjectHistoryLogResponse

  const { metadata, ...rest } = overrides

  return {
    ...baseLog,
    user: '/api/v2/users/john/',
    user_uid: 'umBqhq3XSkkeNEzrFpCfTZ',
    username: 'john',
    action: AuditActions['update-content'],
    metadata: {
      ...baseLog.metadata,
      source: 'Firefox (Mac OS X)',
      asset_uid: mockAssetUid,
      ip_address: '192.168.107.1',
      ...metadata,
    },
    date_created: '2025-04-15T11:31:30Z',
    ...rest,
  } as ActivityLogsItem
}

type ActivityPermissions = NonNullable<ActivityLogsItem['metadata']['permissions']>

const johnLog = (overrides: AssetHistoryLogOverrides) =>
  createHistoryLog({
    user: '/api/v2/users/john/',
    user_uid: 'umBqhq3XSkkeNEzrFpCfTZ',
    username: 'john',
    ...overrides,
  })

const karinaLog = (overrides: AssetHistoryLogOverrides) =>
  createHistoryLog({
    user: '/api/v2/users/karina/',
    user_uid: 'umBqhq3XSkkeNEzrFpCfTx',
    username: 'karina',
    ...overrides,
  })

const deleteSubmissionLog = (rootUuid: string, dateCreated: string) =>
  johnLog({
    action: AuditActions['delete-submission'],
    metadata: {
      submission: {
        root_uuid: rootUuid,
        submitted_by: 'AnonymousUser',
      },
      project_owner: 'john',
    },
    date_created: dateCreated,
  })

const modifyUserPermissionsLog = (permissions: ActivityPermissions, dateCreated: string) =>
  johnLog({
    action: AuditActions['modify-user-permissions'],
    metadata: {
      permissions,
    },
    date_created: dateCreated,
  })

const addMediaAttachmentLog = karinaLog({
  action: AuditActions['add-media'],
  metadata: {
    'asset-files': {
      uid: 'afRwzbjzPQvJRhxic8qzXc7',
      filename: 'secrets.zip',
      md5_hash: 'md5:46f405aafd79d8698efcb4eb8abaa083',
      download_url: `/assets/${mockAssetUid}/files/afRwzbjzPQvJRhxic8qzXc7/content/`,
    },
  },
  date_created: '2025-04-15T11:34:17Z',
})

const bulkTranslatedTranscriptionsLog = karinaLog({
  action: AuditActions['bulk-processing'],
  metadata: {
    bulk_action: {
      uid: 'sbaY9R2P3mF8rQnZ4x1cV7',
      action_id: BULK_PROCESSING_ACTION_IDS.automaticGoogleTranslation,
      type: 'translation',
      status: 'complete',
      question_xpath: '/data/audio_q',
      params: { language: 'es' },
      created_by: 'karina',
      total_count: 8,
      processed_count: 8,
      completed_count: 5,
      failed_count: 1,
      cancelled_count: 2,
    },
  },
  date_created: '2026-05-30T13:43:20Z',
})

const bulkTranscribedAudioFilesLog = karinaLog({
  action: AuditActions['bulk-processing'],
  metadata: {
    bulk_action: {
      uid: 'sbaJ3kN7vL2pQxR5mT8wB1',
      action_id: BULK_PROCESSING_ACTION_IDS.automaticGoogleTranscription,
      type: 'transcription',
      status: 'complete',
      question_xpath: '/data/audio_q',
      params: { language: 'en' },
      created_by: 'karina',
      total_count: 10,
      processed_count: 10,
      completed_count: 7,
      failed_count: 2,
      cancelled_count: 1,
    },
  },
  date_created: '2026-05-30T13:41:20Z',
})

const bulkTranscriptionInProgressLog = johnLog({
  action: AuditActions['bulk-processing'],
  metadata: {
    bulk_action: {
      uid: 'sbaX5mP9vN3wQyT7kR2bC8',
      action_id: BULK_PROCESSING_ACTION_IDS.automaticGoogleTranscription,
      type: 'transcription',
      status: 'in_progress',
      question_xpath: '/data/audio_file',
      params: { language: 'en' },
      created_by: 'john',
      total_count: 25,
      processed_count: 8,
      completed_count: 7,
      failed_count: 1,
      cancelled_count: 0,
    },
  },
  date_created: '2026-06-11T14:22:15Z',
})

const bulkTranslationInProgressLog = karinaLog({
  action: AuditActions['bulk-processing'],
  metadata: {
    bulk_action: {
      uid: 'sbaW2nL6uK4pRxS9jQ3aD5',
      action_id: BULK_PROCESSING_ACTION_IDS.automaticGoogleTranslation,
      type: 'translation',
      status: 'in_progress',
      question_xpath: '/data/transcript',
      params: { language: 'fr' },
      created_by: 'karina',
      total_count: 15,
      processed_count: 3,
      completed_count: 3,
      failed_count: 0,
      cancelled_count: 0,
    },
  },
  date_created: '2026-06-11T14:18:30Z',
})

/**
 * Mock API for project activity (AKA history logs). Use it in Storybook tests in `parameters.msw.handlers[]`.
 */
const assetHistoryMock = http.get<PathParams<'limit' | 'start' | 'q'>, never, PaginatedResponse<ActivityLogsItem>>(
  endpoints.ASSET_HISTORY.replace(':asset_uid', mockAssetUid),
  (info) => {
    const searchParams = new URL(info.request.url).searchParams
    if (searchParams.get('q') === 'action:add-media') {
      return HttpResponse.json(assetHistoryFilteredResponse)
    } else if (searchParams.get('limit') === '10' && searchParams.get('start') === '20') {
      return HttpResponse.json(assetHistoryResponsePage3)
    } else if (searchParams.get('limit') === '10' && searchParams.get('start') === '10') {
      return HttpResponse.json(assetHistoryResponsePage2)
    } else {
      return HttpResponse.json(assetHistoryResponsePage1)
    }
  },
)
export default assetHistoryMock

const assetHistoryResponsePage1: PaginatedResponse<ActivityLogsItem> = {
  count: 26,
  next: '/api/v2/assets/a1234567890bcdEFGhijkl/history/?limit=10&start=10&q=NOT+action%3A%27add-submission%27',
  previous: null,
  results: [
    bulkTranslatedTranscriptionsLog,
    bulkTranscribedAudioFilesLog,
    deleteSubmissionLog('06c6421b-1917-4fd8-9d56-0033bf05f925', '2025-04-22T08:38:24Z'),
    deleteSubmissionLog('61175e5d-f1a2-4511-92d7-0fd0a6ae4942', '2025-04-22T08:38:24Z'),
    deleteSubmissionLog('5913ab53-1698-4930-8f69-797a36e957c3', '2025-04-22T08:38:24Z'),
    deleteSubmissionLog('a5ebf21b-c859-4ec2-8daf-a4a81596510d', '2025-04-22T08:38:24Z'),
    deleteSubmissionLog('0f411e44-073f-498d-92bc-42c941aca526', '2025-04-22T08:38:24Z'),
    deleteSubmissionLog('e06c4056-8453-42eb-ad39-7e7eb1652507', '2025-04-22T08:38:24Z'),
    johnLog({
      action: AuditActions['disallow-anonymous-submissions'],
      date_created: '2025-04-22T08:38:02Z',
    }),
    modifyUserPermissionsLog(
      {
        added: [
          'partial_submissions',
          {
            code: 'add_submissions',
            filters: [
              {
                _submitted_by: 'jackie',
              },
            ],
          },
          {
            code: 'change_submissions',
            filters: [
              {
                _submitted_by: 'jackie',
              },
            ],
          },
          {
            code: 'view_submissions',
            filters: [
              {
                _submitted_by: {
                  $in: ['jackie', 'john'],
                },
              },
              {
                _submitted_by: 'jackie',
              },
            ],
          },
        ],
        removed: [],
        username: 'zefir',
      },
      '2025-04-22T08:35:56Z',
    ),
  ],
}

const assetHistoryResponsePage2: PaginatedResponse<ActivityLogsItem> = {
  count: 26,
  next: 'http://kf.kobo.local/api/v2/assets/a1234567890bcdEFGhijkl/history/?limit=10&start=20&q=NOT+action%3A%27add-submission%27',
  previous:
    'http://kf.kobo.local/api/v2/assets/a1234567890bcdEFGhijkl/history/?limit=10&q=NOT+action%3A%27add-submission%27',
  results: [
    modifyUserPermissionsLog(
      {
        added: [
          'partial_submissions',
          {
            code: 'add_submissions',
            filters: [
              {
                _submitted_by: 'jackie',
              },
            ],
          },
          {
            code: 'change_submissions',
            filters: [
              {
                _submitted_by: 'jackie',
              },
            ],
          },
          {
            code: 'view_submissions',
            filters: [
              {
                _submitted_by: '*',
              },
              {
                _submitted_by: 'jackie',
              },
            ],
          },
        ],
        removed: [],
        username: 'zefir',
      },
      '2025-04-22T08:35:27Z',
    ),
    modifyUserPermissionsLog(
      {
        added: [],
        removed: ['manage_asset', 'validate_submissions', 'change_submissions', 'change_asset', 'delete_submissions'],
        username: 'jackie',
      },
      '2025-04-22T08:29:23Z',
    ),
    modifyUserPermissionsLog(
      {
        added: ['add_submissions', 'view_submissions', 'view_asset'],
        removed: [],
        username: 'john',
      },
      '2025-04-22T08:29:14Z',
    ),
    modifyUserPermissionsLog(
      {
        added: [
          'add_submissions',
          'partial_submissions',
          {
            code: 'add_submissions',
            filters: [
              {
                _submitted_by: 'jackie',
              },
            ],
          },
          {
            code: 'change_submissions',
            filters: [
              {
                _submitted_by: 'jackie',
              },
            ],
          },
          {
            code: 'view_submissions',
            filters: [
              {
                _submitted_by: 'jackie',
              },
            ],
          },
        ],
        removed: [],
        username: 'zefir',
      },
      '2025-04-22T08:28:53Z',
    ),
    modifyUserPermissionsLog(
      {
        added: [
          'manage_asset',
          'validate_submissions',
          'change_submissions',
          'change_asset',
          'add_submissions',
          'view_asset',
          'view_submissions',
          'delete_submissions',
        ],
        removed: [],
        username: 'jackie',
      },
      '2025-04-22T08:28:37Z',
    ),
    deleteSubmissionLog('e06c4056-8453-42eb-ad39-7e7eb1652507', '2025-04-16T08:02:00Z'),
    deleteSubmissionLog('96656184-e878-4b1e-bf7c-a536703c1ba2', '2025-04-16T07:59:21Z'),
    deleteSubmissionLog('96656184-e878-4b1e-bf7c-a536703c1ba2', '2025-04-16T07:58:54Z'),
    deleteSubmissionLog('96656184-e878-4b1e-bf7c-a536703c1ba2', '2025-04-16T07:56:42Z'),
    deleteSubmissionLog('96656184-e878-4b1e-bf7c-a536703c1ba2', '2025-04-16T07:49:58Z'),
  ],
}

const assetHistoryResponsePage3: PaginatedResponse<ActivityLogsItem> = {
  count: 26,
  next: null,
  previous:
    'http://kf.kobo.local/api/v2/assets/a1234567890bcdEFGhijkl/history/?limit=10&start=10&q=NOT+action%3A%27add-submission%27',
  results: [
    modifyUserPermissionsLog(
      {
        added: ['view_asset'],
        removed: [],
        username: 'zefir',
      },
      '2025-04-16T07:37:22Z',
    ),
    modifyUserPermissionsLog(
      {
        added: ['view_asset'],
        removed: [],
        username: 'zefir',
      },
      '2025-04-16T07:36:29Z',
    ),
    addMediaAttachmentLog,
    johnLog({
      action: AuditActions['allow-anonymous-submissions'],
      date_created: '2025-04-15T11:31:49Z',
    }),
    johnLog({
      action: AuditActions['deploy'],
      metadata: {
        latest_version_uid: 'vgFzDVpq4LgwkXH45d6d5H',
      },
      date_created: '2025-04-15T11:31:36Z',
    }),
    johnLog({
      action: AuditActions['update-content'],
      metadata: {
        latest_version_uid: 'vgFzDVpq4LgwkXH45d6d5H',
      },
      date_created: '2025-04-15T11:31:30Z',
    }),
  ],
}

/**
 * Response to be used when filtering by action `add-media`.
 */
const assetHistoryFilteredResponse: PaginatedResponse<ActivityLogsItem> = {
  count: 1,
  next: null,
  previous: null,
  results: [addMediaAttachmentLog],
}

/**
 * Response with ongoing bulk processing jobs for testing.
 */
export const assetHistoryWithOngoingBulkProcessing: PaginatedResponse<ActivityLogsItem> = {
  count: 4,
  next: null,
  previous: null,
  results: [
    bulkTranscriptionInProgressLog,
    bulkTranslationInProgressLog,
    bulkTranslatedTranscriptionsLog,
    bulkTranscribedAudioFilesLog,
  ],
}

/**
 * Mock API for project activity with ongoing bulk processing. Use it in Storybook tests in `parameters.msw.handlers[]`.
 */
export const assetHistoryMockWithOngoingBulkProcessing = http.get<
  PathParams<'limit' | 'start' | 'q'>,
  never,
  PaginatedResponse<ActivityLogsItem>
>(endpoints.ASSET_HISTORY.replace(':asset_uid', mockAssetUid), () =>
  HttpResponse.json(assetHistoryWithOngoingBulkProcessing),
)
