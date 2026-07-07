import { http, HttpResponse, type PathParams } from 'msw'
import { endpoints } from '#/api.endpoints'
import { ActionIdEnum } from '#/api/models/actionIdEnum'
import type { BulkActionListResponse } from '#/api/models/bulkActionListResponse'
import type { BulkActionResponse } from '#/api/models/bulkActionResponse'
import { BulkActionResponseStatusEnum } from '#/api/models/bulkActionResponseStatusEnum'
import { BulkActionSubmissionStatusResponseStatusEnum } from '#/api/models/bulkActionSubmissionStatusResponseStatusEnum'
import { getApiV2AssetsAdvancedFeaturesBulkActionsRetrieveResponseMock } from '#/api/react-query/survey-data'

/**
 * Mock API for bulk actions list. Use it in Storybook tests in `parameters.msw.handlers.bulkActions`.
 */

const bulkActionsMock = (assetUid = 'uuid:mock-uuid-1', override?: Partial<BulkActionListResponse>) =>
  http.get<PathParams<'uid'>, never, BulkActionListResponse>(
    endpoints.ASSET_ADVANCED_FEATURES_BULK_ACTIONS,
    ({ params }) => {
      // Only respond for the correct assetUid
      if (params.uid !== assetUid) return undefined
      return HttpResponse.json({
        ...defaultBulkActionsResponse,
        ...override,
        count: override?.results?.length ?? defaultBulkActionsResponse.count,
        results: override?.results ?? defaultBulkActionsResponse.results,
      })
    },
  )

export default bulkActionsMock

const defaultBulkActionsResponse: BulkActionListResponse = {
  count: 1,
  next: null,
  previous: null,
  results: [
    getApiV2AssetsAdvancedFeaturesBulkActionsRetrieveResponseMock({
      uid: 'bulk-action-uid',
      status: BulkActionResponseStatusEnum.in_progress,
      action_id: ActionIdEnum.automatic_google_transcription,
      question_xpath: 'Your_name',
      submission_uuids: ['uuid:mock-uuid-1'],
      submission_statuses: [
        {
          uuid: 'uuid:mock-uuid-1',
          status: BulkActionSubmissionStatusResponseStatusEnum.in_progress,
          error: null,
        },
      ],
      params: {
        language: 'fr',
      },
      progress: 0,
      created_by: {
        username: 'zefir',
      },
      date_created: '2026-01-01T00:00:00Z',
      date_modified: '2026-01-01T00:00:00Z',
    }),
  ],
}

/**
 * Mock API for bulk action PATCH operations (cancel). Use it in Storybook tests in `parameters.msw.handlers[]`.
 */
export const bulkActionCancelMock = http.patch<PathParams<'uid' | 'actionUid'>, { status?: string }>(
  `${endpoints.ASSET_ADVANCED_FEATURES_BULK_ACTIONS}:actionUid/`,
  async ({ request }) => {
    const body = await request.json()

    // Simulate cancellation
    if (body?.status === BulkActionResponseStatusEnum.cancelled) {
      const response: Partial<BulkActionResponse> = {
        status: BulkActionResponseStatusEnum.cancelled,
      }
      return HttpResponse.json(response)
    }

    return HttpResponse.json({ error: 'Invalid request' }, { status: 400 })
  },
)
