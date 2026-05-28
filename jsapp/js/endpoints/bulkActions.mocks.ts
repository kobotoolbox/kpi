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
        ...defaultMockResponse,
        ...override,
        results: override?.results ?? defaultMockResponse.results,
      }),
  )

export default bulkActionsMock

const defaultMockResponse: BulkActionListResponse = {
  count: 2,
  next: null,
  previous: null,
  results: [
    {
      uid: 'bulk-action-transcript-1',
      status: BulkActionResponseStatusEnum.in_progress,
      action_id: ActionIdEnum.automatic_google_transcription,
      question_xpath: 'Secret_password_as_an_audio_file',
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
      progress: 25,
      created_by: {
        username: 'leszek',
      },
      date_created: '2026-05-13T00:00:00Z',
      date_modified: '2026-05-13T00:00:00Z',
    },
    {
      uid: 'bulk-action-translation-1',
      status: BulkActionResponseStatusEnum.in_progress,
      action_id: ActionIdEnum.automatic_google_translation,
      question_xpath: 'Secret_password_as_an_audio_file',
      submission_uuids: ['69ff2e33-4d4b-4891-8c81-82d7316cf51f'],
      submission_statuses: [
        {
          uuid: '69ff2e33-4d4b-4891-8c81-82d7316cf51f',
          status: BulkActionSubmissionStatusResponseStatusEnum.in_progress,
        },
      ],
      params: {
        language: 'pl',
      },
      progress: 50,
      created_by: {
        username: 'leszek',
      },
      date_created: '2026-05-13T00:00:00Z',
      date_modified: '2026-05-13T00:00:00Z',
    },
  ],
}
