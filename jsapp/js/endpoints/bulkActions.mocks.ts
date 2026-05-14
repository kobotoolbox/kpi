import { http, HttpResponse, type PathParams } from 'msw'
import { ActionIdEnum } from '#/api/models/actionIdEnum'
import type { BulkActionListResponse } from '#/api/models/bulkActionListResponse'
import { BulkActionResponseStatusEnum } from '#/api/models/bulkActionResponseStatusEnum'
import { BulkActionSubmissionStatusResponseStatusEnum } from '#/api/models/bulkActionSubmissionStatusResponseStatusEnum'

/**
 * Mock API for bulk actions list. Use it in Storybook tests in `parameters.msw.handlers.bulkActions`.
 */

const bulkActionsMock = (override?: Partial<BulkActionListResponse>) =>
  http.get<PathParams<'uidAsset'>, never, BulkActionListResponse>(
    '/api/v2/assets/:uidAsset/advanced-features/bulk-actions/',
    () =>
      HttpResponse.json({
        ...processingBulkActionsResponse,
        ...override,
        results: override?.results ?? processingBulkActionsResponse.results,
      }),
  )

export default bulkActionsMock

const processingBulkActionsResponse: BulkActionListResponse = {
  count: 1,
  next: null,
  previous: null,
  results: [
    {
      uid: 'bulk-action-transcript-1',
      status: BulkActionResponseStatusEnum.in_progress,
      action_id: ActionIdEnum.automatic_google_transcription,
      question_xpath: 'First_name',
      submission_uuids: ['faa38eee-4e3f-419e-bac0-e95f1085d998'],
      submission_statuses: [
        {
          uuid: 'faa38eee-4e3f-419e-bac0-e95f1085d998',
          status: BulkActionSubmissionStatusResponseStatusEnum.in_progress,
        },
      ],
      params: {
        language: 'fr',
      },
      created_by: {
        username: 'leszek',
      },
      date_created: '2026-05-13T00:00:00Z',
      date_modified: '2026-05-13T00:00:00Z',
    },
  ],
}

const completeBulkActionsResponse: BulkActionListResponse = {
  count: 1,
  next: null,
  previous: null,
  results: [
    {
      uid: 'bulk-action-transcript-1',
      status: BulkActionResponseStatusEnum.complete,
      action_id: ActionIdEnum.automatic_google_transcription,
      question_xpath: 'First_name',
      submission_uuids: ['faa38eee-4e3f-419e-bac0-e95f1085d998'],
      submission_statuses: [
        {
          uuid: 'faa38eee-4e3f-419e-bac0-e95f1085d998',
          status: BulkActionSubmissionStatusResponseStatusEnum.complete,
        },
      ],
      params: {
        language: 'fr',
      },
      created_by: {
        username: 'leszek',
      },
      date_created: '2026-05-13T00:00:00Z',
      date_modified: '2026-05-13T00:00:00Z',
    },
  ],
}

const failedBulkActionsResponse: BulkActionListResponse = {
  count: 1,
  next: null,
  previous: null,
  results: [
    {
      uid: 'bulk-action-transcript-1',
      status: BulkActionResponseStatusEnum.complete,
      action_id: ActionIdEnum.automatic_google_transcription,
      question_xpath: 'First_name',
      submission_uuids: ['faa38eee-4e3f-419e-bac0-e95f1085d998'],
      submission_statuses: [
        {
          uuid: 'faa38eee-4e3f-419e-bac0-e95f1085d998',
          status: BulkActionSubmissionStatusResponseStatusEnum.failed,
        },
      ],
      params: {
        language: 'fr',
      },
      created_by: {
        username: 'leszek',
      },
      date_created: '2026-05-13T00:00:00Z',
      date_modified: '2026-05-13T00:00:00Z',
    },
  ],
}

export { processingBulkActionsResponse, completeBulkActionsResponse, failedBulkActionsResponse }
